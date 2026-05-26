# Authentication

Maxwell's Wallet is a single-user application protected by a username and
password. Access is gated by a JSON Web Token (JWT) issued at login, so every
API request after setup must carry a valid token.

## First-Run Setup

On the very first launch no user exists yet, so the app redirects you to
`/setup`:

1. Open the app at `http://localhost:3000`
2. You are redirected to `/setup`
3. Choose a username and password
4. You are logged in automatically and a session token is stored in your browser

Once a user exists, `/setup` is closed — the setup endpoint only succeeds when
the database has no users.

## Logging In

After setup, visiting the app while logged out shows the login screen. Enter
your username and password to receive a fresh session token. Tokens expire after
`TOKEN_EXPIRE_HOURS` (one week by default); after that you log in again.

## Changing Your Password

Change your password from the UI while logged in (Settings → account). This
requires your current password.

## Resetting a Forgotten Password (CLI)

If you are locked out, reset the password from the container — no UI access
required:

```bash
# Against a running container
docker compose exec maxwells-wallet reset-password <username> <new_password>

# Or a one-off container
docker compose run --rm maxwells-wallet reset-password <username> <new_password>
```

## Configuration

JWTs are signed with `SECRET_KEY`. The default is a development placeholder, so
**always set a strong, random `SECRET_KEY` in production** — otherwise tokens are
forgeable.

```bash
docker run -d -p 3000:3000 -p 3001:3001 \
  -e SECRET_KEY="$(openssl rand -hex 32)" \
  -v /path/to/data:/data \
  ghcr.io/poindexter12/maxwells-wallet
```

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | dev placeholder | JWT signing key. **Set in production.** |
| `TOKEN_EXPIRE_HOURS` | `168` (1 week) | Session token lifetime in hours |

Changing `SECRET_KEY` invalidates all existing sessions, requiring everyone to
log in again.

## Auth API

The auth endpoints live under `/api/v1/auth`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/auth/status` | Whether a user exists and whether the request is authenticated |
| POST | `/api/v1/auth/setup` | Create the first user (only when none exists) |
| POST | `/api/v1/auth/login` | Authenticate and receive a JWT |
| GET | `/api/v1/auth/me` | Current authenticated user info |
| PUT | `/api/v1/auth/password` | Change the current user's password |

All other API requests require an `Authorization: Bearer <token>` header. See the
[API Overview](../api/overview.md) for details.
