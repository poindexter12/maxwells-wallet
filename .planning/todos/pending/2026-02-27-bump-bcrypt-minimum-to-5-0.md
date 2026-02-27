---
created: 2026-02-27T14:57:27.074Z
title: Bump bcrypt minimum to 5.0
area: auth
files:
  - backend/pyproject.toml
  - backend/app/utils/auth.py
---

## Problem

bcrypt 4.x silently truncates passwords longer than 72 bytes. bcrypt 5.0 changes this to raise a `ValueError`, which is better security behavior but could surface as an unhandled error if a user enters a very long password.

Currently `app/utils/auth.py` calls `bcrypt.hashpw(password.encode(), bcrypt.gensalt())` directly with no length guard.

## Solution

1. Bump `bcrypt>=5.0.0` in `backend/pyproject.toml`
2. Either add a pre-hash step (SHA-256 + base64 before bcrypt) or enforce a 72-byte limit at the API validation layer
3. Run `uv lock --upgrade` to pull bcrypt 5.x
4. Verify existing password hashes remain compatible (bcrypt 5 is backwards-compatible for verification)
