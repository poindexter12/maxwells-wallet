"""Standardized error codes and exceptions for API responses.

Error codes are designed to be translated on the frontend using i18n.
The frontend should map error_code to a translated message string.
"""

from enum import Enum
from typing import Any, Optional
from fastapi import HTTPException


class ErrorCode(str, Enum):
    """Standardized error codes for API responses.

    These codes are used by the frontend to display translated error messages.
    The naming convention is: ENTITY_ACTION or ENTITY_STATE.
    """

    # Transaction errors
    TRANSACTION_NOT_FOUND = "TRANSACTION_NOT_FOUND"
    TRANSACTIONS_NOT_FOUND = "TRANSACTIONS_NOT_FOUND"
    TRANSACTION_NOT_LINKED = "TRANSACTION_NOT_LINKED"
    NO_TRANSACTION_IDS = "NO_TRANSACTION_IDS"

    # Tag errors
    TAG_NOT_FOUND = "TAG_NOT_FOUND"
    TAG_ALREADY_EXISTS = "TAG_ALREADY_EXISTS"
    TAG_IN_USE = "TAG_IN_USE"
    TAG_NOT_APPLIED = "TAG_NOT_APPLIED"
    TAG_INVALID_FORMAT = "TAG_INVALID_FORMAT"

    # Dashboard errors
    DASHBOARD_NOT_FOUND = "DASHBOARD_NOT_FOUND"
    CANNOT_DELETE_LAST_DASHBOARD = "CANNOT_DELETE_LAST_DASHBOARD"

    # Widget errors
    WIDGET_NOT_FOUND = "WIDGET_NOT_FOUND"

    # Budget errors
    BUDGET_NOT_FOUND = "BUDGET_NOT_FOUND"
    BUDGET_ALREADY_EXISTS = "BUDGET_ALREADY_EXISTS"

    # Filter errors
    FILTER_NOT_FOUND = "FILTER_NOT_FOUND"

    # Account errors
    ACCOUNT_NOT_FOUND = "ACCOUNT_NOT_FOUND"
    ACCOUNT_INVALID_DUE_DAY = "ACCOUNT_INVALID_DUE_DAY"
    ACCOUNT_INVALID_CREDIT_LIMIT = "ACCOUNT_INVALID_CREDIT_LIMIT"

    # Merchant alias errors
    ALIAS_NOT_FOUND = "ALIAS_NOT_FOUND"
    ALIAS_ALREADY_EXISTS = "ALIAS_ALREADY_EXISTS"

    # Recurring pattern errors
    PATTERN_NOT_FOUND = "PATTERN_NOT_FOUND"

    # Tag rule errors
    RULE_NOT_FOUND = "RULE_NOT_FOUND"
    RULE_DISABLED = "RULE_DISABLED"

    # Import errors
    IMPORT_FORMAT_NOT_FOUND = "IMPORT_FORMAT_NOT_FOUND"
    IMPORT_CONFIG_NOT_FOUND = "IMPORT_CONFIG_NOT_FOUND"
    IMPORT_NO_FILES = "IMPORT_NO_FILES"
    IMPORT_NO_TRANSACTIONS = "IMPORT_NO_TRANSACTIONS"
    IMPORT_UNSUPPORTED_FORMAT = "IMPORT_UNSUPPORTED_FORMAT"
    IMPORT_PARSE_ERROR = "IMPORT_PARSE_ERROR"
    IMPORT_SESSION_NOT_FOUND = "IMPORT_SESSION_NOT_FOUND"

    # Admin/confirmation errors
    CONFIRMATION_REQUIRED = "CONFIRMATION_REQUIRED"

    # Backup errors
    BACKUP_NOT_FOUND = "BACKUP_NOT_FOUND"
    CANNOT_DELETE_DEMO_BACKUP = "CANNOT_DELETE_DEMO_BACKUP"
    BACKUP_RESTORE_FAILED = "BACKUP_RESTORE_FAILED"

    # Demo mode errors
    DEMO_MODE_RESTRICTED = "DEMO_MODE_RESTRICTED"

    # Validation errors
    VALIDATION_ERROR = "VALIDATION_ERROR"
    INVALID_REGEX = "INVALID_REGEX"

    # Authentication errors
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    USER_NOT_FOUND = "USER_NOT_FOUND"
    USER_ALREADY_EXISTS = "USER_ALREADY_EXISTS"
    NOT_AUTHENTICATED = "NOT_AUTHENTICATED"
    INVALID_TOKEN = "INVALID_TOKEN"
    SETUP_ALREADY_COMPLETE = "SETUP_ALREADY_COMPLETE"
    INVALID_PASSWORD = "INVALID_PASSWORD"


class AppException(HTTPException):
    """Application exception with structured error response.

    Returns JSON response in the format:
    {
        "error_code": "TAG_NOT_FOUND",
        "message": "Optional human-readable message",
        "context": {"tag_id": 123}  // Optional context for interpolation
    }

    The frontend uses error_code to look up the translated message,
    and context for interpolation (e.g., "Tag {tag_id} not found").
    """

    def __init__(
        self,
        status_code: int,
        error_code: ErrorCode,
        message: Optional[str] = None,
        context: Optional[dict[str, Any]] = None,
    ):
        detail = {
            "error_code": error_code.value,
            "message": message,
            "context": context or {},
        }
        super().__init__(status_code=status_code, detail=detail)
        self.error_code = error_code
        self.context = context or {}


# Convenience functions for common error patterns


def not_found(error_code: ErrorCode, message: Optional[str] = None, **context: Any) -> AppException:
    """Create a 404 Not Found exception."""
    return AppException(404, error_code, message, context if context else None)


def bad_request(error_code: ErrorCode, message: Optional[str] = None, **context: Any) -> AppException:
    """Create a 400 Bad Request exception."""
    return AppException(400, error_code, message, context if context else None)


def conflict(error_code: ErrorCode, message: Optional[str] = None, **context: Any) -> AppException:
    """Create a 409 Conflict exception."""
    return AppException(409, error_code, message, context if context else None)


def unauthorized(error_code: ErrorCode, message: Optional[str] = None, **context: Any) -> AppException:
    """Create a 401 Unauthorized exception."""
    return AppException(401, error_code, message, context if context else None)
