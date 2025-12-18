"""
CLI script to reset a user's password.

Usage:
    # Direct usage
    python -m scripts.reset_password <username> <new_password>

    # Via Docker
    docker compose exec app reset-password <username> <new_password>
    docker compose run --rm app reset-password <username> <new_password>
"""

import asyncio
import sys

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import select

from app.config import settings
from app.models import User
from app.utils.auth import hash_password


async def reset_password(username: str, new_password: str) -> bool:
    """Reset password for a user.

    Args:
        username: The username to reset password for
        new_password: The new password to set

    Returns:
        True if successful, False if user not found
    """
    engine = create_async_engine(settings.database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()

        if user is None:
            await engine.dispose()
            return False

        user.password_hash = hash_password(new_password)
        session.add(user)
        await session.commit()

    await engine.dispose()
    return True


def main():
    if len(sys.argv) != 3:
        print("Usage: python -m scripts.reset_password <username> <new_password>")
        print()
        print("Example:")
        print("  python -m scripts.reset_password admin newpassword123")
        print()
        print("Via Docker:")
        print("  docker compose exec app reset-password <username> <new_password>")
        print("  docker compose run --rm app reset-password <username> <new_password>")
        sys.exit(1)

    username = sys.argv[1]
    new_password = sys.argv[2]

    if len(new_password) < 4:
        print("Error: Password must be at least 4 characters")
        sys.exit(1)

    success = asyncio.run(reset_password(username, new_password))

    if success:
        print(f"Password reset successfully for user: {username}")
    else:
        print(f"Error: User not found: {username}")
        sys.exit(1)


if __name__ == "__main__":
    main()
