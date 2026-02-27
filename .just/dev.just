# Development recipes
set working-directory := '..'

# Run backend server (runs migrations first)
backend:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Running database migrations..."
    cd backend && uv run alembic upgrade head
    style 2 "Starting backend server..."
    cd backend && . .venv/bin/activate && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run frontend development server
frontend:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    if [ "${ENABLE_PSEUDO:-}" = "true" ]; then
        style 12 "ENABLE_PSEUDO=true: Regenerating pseudo-locale..."
        cd frontend && node scripts/generate-pseudo-locale.mjs
        cd ..
    fi
    style 12 "Starting frontend server..."
    cd frontend && npm run dev

# Run both backend and frontend in parallel
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Starting development servers..."
    just dev::backend &
    just dev::frontend &
    wait

# Build frontend for production
build-frontend:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Building frontend..."
    cd frontend && npm run build
    style 2 "Frontend built."
