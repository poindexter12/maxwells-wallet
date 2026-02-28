"""Shared helpers for import routes (core + custom CSV)."""

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
import re as regex_module

from app.orm import ImportFormatType, MerchantAlias, MerchantAliasMatchType, Tag, TransactionTag
from app.parsers import ParserRegistry

# Supported import file extensions
SUPPORTED_EXTENSIONS = (".csv", ".qif", ".qfx", ".ofx")


def is_valid_import_file(filename: str) -> bool:
    """Check if a filename has a supported import extension."""
    return filename.lower().endswith(SUPPORTED_EXTENSIONS)


def _parse_csv(
    csv_content: str, account_source: Optional[str] = None, format_hint: Optional[ImportFormatType] = None
) -> tuple[list, ImportFormatType]:
    """Parse CSV/QIF/QFX content via ParserRegistry and return (transactions_dicts, format_type)."""
    format_type: ImportFormatType
    if format_hint is not None and format_hint != ImportFormatType.unknown:
        format_key = format_hint.value if hasattr(format_hint, "value") else format_hint
        parser = ParserRegistry.get_parser(format_key)
        format_type = format_hint if isinstance(format_hint, ImportFormatType) else ImportFormatType(format_hint)
    else:
        parser, _confidence = ParserRegistry.detect_format(csv_content)
        if parser:
            try:
                format_type = ImportFormatType(parser.format_key)
            except ValueError:
                format_type = ImportFormatType.unknown
        else:
            format_type = ImportFormatType.unknown

    if parser is None:
        return [], format_type

    parsed = parser.parse(csv_content, account_source)
    return [t.to_dict() for t in parsed], format_type


async def get_or_create_bucket_tag(session: AsyncSession, bucket_value: str) -> Tag:
    """Get bucket tag by value, creating if needed"""
    result = await session.execute(select(Tag).where(and_(Tag.namespace == "bucket", Tag.value == bucket_value)))
    tag = result.scalar_one_or_none()
    if not tag:
        # Create the bucket tag
        tag = Tag(namespace="bucket", value=bucket_value)
        session.add(tag)
        await session.flush()
    return tag


async def get_or_create_account_tag(session: AsyncSession, account_source: str) -> Tag:
    """Get or create an account tag for the given account_source.

    The tag value is the normalized account_source (lowercase, dashes for spaces).
    The description defaults to the original account_source as the display name.
    """
    # Normalize to tag value format
    tag_value = account_source.lower().replace(" ", "-")

    result = await session.execute(select(Tag).where(and_(Tag.namespace == "account", Tag.value == tag_value)))
    tag = result.scalar_one_or_none()
    if not tag:
        # Create the account tag with original name as description (display name)
        tag = Tag(
            namespace="account",
            value=tag_value,
            description=account_source,  # Use original as default display name
        )
        session.add(tag)
        await session.flush()
    return tag


async def apply_bucket_tag(session: AsyncSession, transaction_id: int, bucket_value: str):
    """Apply a bucket tag to a transaction"""
    tag = await get_or_create_bucket_tag(session, bucket_value)

    # Remove any existing bucket tags first
    existing_result = await session.execute(
        select(TransactionTag)
        .join(Tag)
        .where(and_(TransactionTag.transaction_id == transaction_id, Tag.namespace == "bucket"))
    )
    for existing in existing_result.scalars().all():
        await session.delete(existing)

    # Add the new bucket tag
    txn_tag = TransactionTag(transaction_id=transaction_id, tag_id=tag.id)
    session.add(txn_tag)


async def get_merchant_aliases(session: AsyncSession) -> List[MerchantAlias]:
    """Get all merchant aliases ordered by priority (highest first)"""
    result = await session.execute(select(MerchantAlias).order_by(MerchantAlias.priority.desc()))
    return list(result.scalars().all())


def apply_merchant_alias(description: str, aliases: List[MerchantAlias]) -> Optional[str]:
    """
    Apply merchant aliases to get a canonical merchant name from a description.
    Returns the canonical name if matched, None otherwise.
    """
    if not description:
        return None

    desc_lower = description.lower()

    for alias in aliases:
        pattern_lower = alias.pattern.lower()

        if alias.match_type == MerchantAliasMatchType.exact:
            if desc_lower == pattern_lower:
                return alias.canonical_name
        elif alias.match_type == MerchantAliasMatchType.contains:
            if pattern_lower in desc_lower:
                return alias.canonical_name
        elif alias.match_type == MerchantAliasMatchType.regex:
            try:
                if regex_module.search(alias.pattern, description, regex_module.IGNORECASE):
                    return alias.canonical_name
            except regex_module.error:
                continue

    return None
