"""
Application version information.

Reads version from environment variables (Docker builds) or pyproject.toml (local dev).
"""

import os
from functools import lru_cache


@lru_cache
def get_version() -> str:
    """
    Get application version.

    Priority:
    1. APP_VERSION environment variable (set during Docker build)
    2. Read from pyproject.toml (local development)
    3. Fallback to "unknown"
    """
    if version := os.environ.get("APP_VERSION"):
        return version

    # Try reading from pyproject.toml for local dev
    try:
        import tomllib
        from pathlib import Path

        pyproject_path = Path(__file__).parent.parent / "pyproject.toml"
        if pyproject_path.exists():
            with open(pyproject_path, "rb") as f:
                data = tomllib.load(f)
                project = data.get("project", {})
                if isinstance(project, dict):
                    version = project.get("version")
                    if isinstance(version, str):
                        return version
    except Exception:
        pass

    return "unknown"


@lru_cache
def get_git_sha() -> str | None:
    """
    Get git commit SHA.

    Returns None if not available (local dev without git info).
    """
    return os.environ.get("GIT_SHA")


@lru_cache
def get_version_info() -> dict:
    """
    Get full version information.

    Returns dict with version and optional git_sha.
    """
    info = {"version": get_version()}
    if sha := get_git_sha():
        info["git_sha"] = sha
    return info
