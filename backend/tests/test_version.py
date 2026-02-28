"""Tests for app/version.py — version reading logic."""

import os
import pytest
from unittest.mock import patch
from app.version import get_version, get_git_sha, get_version_info


@pytest.fixture(autouse=True)
def clear_lru_caches():
    """Clear lru_cache between tests so each test starts fresh."""
    get_version.cache_clear()
    get_git_sha.cache_clear()
    get_version_info.cache_clear()
    yield
    get_version.cache_clear()
    get_git_sha.cache_clear()
    get_version_info.cache_clear()


class TestGetVersion:
    def test_version_from_env(self):
        """APP_VERSION env var takes priority."""
        with patch.dict(os.environ, {"APP_VERSION": "1.2.3"}):
            assert get_version() == "1.2.3"

    def test_version_from_pyproject(self):
        """Falls back to pyproject.toml when no env var."""
        env = os.environ.copy()
        env.pop("APP_VERSION", None)
        with patch.dict(os.environ, env, clear=True):
            result = get_version()
            # Should find the real pyproject.toml in this repo
            assert isinstance(result, str)
            assert len(result) > 0

    def test_version_fallback_unknown(self):
        """Returns 'unknown' when both env and pyproject fail."""
        env = os.environ.copy()
        env.pop("APP_VERSION", None)
        with patch.dict(os.environ, env, clear=True):
            with patch("builtins.open", side_effect=Exception("no file")):
                assert get_version() == "unknown"


class TestGetGitSha:
    def test_git_sha_from_env(self):
        with patch.dict(os.environ, {"GIT_SHA": "abc1234"}):
            assert get_git_sha() == "abc1234"

    def test_git_sha_not_set(self):
        env = os.environ.copy()
        env.pop("GIT_SHA", None)
        with patch.dict(os.environ, env, clear=True):
            assert get_git_sha() is None


class TestGetVersionInfo:
    def test_version_info_with_sha(self):
        with patch.dict(os.environ, {"APP_VERSION": "2.0.0", "GIT_SHA": "deadbeef"}):
            info = get_version_info()
            assert info["version"] == "2.0.0"
            assert info["git_sha"] == "deadbeef"

    def test_version_info_without_sha(self):
        env = os.environ.copy()
        env.pop("GIT_SHA", None)
        with patch.dict(os.environ, {**env, "APP_VERSION": "2.0.0"}, clear=True):
            info = get_version_info()
            assert info["version"] == "2.0.0"
            assert "git_sha" not in info
