# All-in-One Dockerfile for Maxwell's Wallet
# Runs both FastAPI backend and Next.js frontend in a single container

FROM node:24-slim@sha256:e8e2e91b1378f83c5b2dd15f0247f34110e2fe895f6ca7719dbb780f929368eb AS frontend-builder

# Build args
ARG ENABLE_PSEUDO=false
ARG APP_VERSION=unknown
ARG GIT_SHA

WORKDIR /app/frontend

# Install production dependencies only (skip devDependencies like crowdin-context-harvester
# which pulls vscode-ripgrep that downloads binaries from GitHub CDN - often flaky)
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --omit=dev

# Copy frontend source and build
COPY frontend/ ./
# Ensure public directory exists (may be empty)
RUN mkdir -p public

# Generate pseudo-locale for QA testing (only if enabled)
RUN if [ "$ENABLE_PSEUDO" = "true" ]; then \
      echo "==> ENABLE_PSEUDO=true: Generating pseudo-locale for QA testing..."; \
      node scripts/generate-pseudo-locale.mjs; \
      echo "==> Pseudo-locale generated successfully"; \
    else \
      echo "==> ENABLE_PSEUDO=false: Skipping pseudo-locale (set ENABLE_PSEUDO=true in .env to enable)"; \
    fi

ENV BACKEND_URL=http://localhost:3001
# Pass pseudo locale setting to Next.js build
ENV NEXT_PUBLIC_ENABLE_PSEUDO=$ENABLE_PSEUDO
RUN echo "==> Building Next.js with NEXT_PUBLIC_ENABLE_PSEUDO=$ENABLE_PSEUDO" && npm run build

# Final stage: Python + Node runtime
FROM python:3.12-slim@sha256:f3fa41d74a768c2fce8016b98c191ae8c1bacd8f1152870a3f9f87d350920b7c

# Re-declare build args for this stage
ARG APP_VERSION=unknown
ARG GIT_SHA

# Install Node.js and system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    nodejs \
    npm \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Install uv for Python package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Setup Python backend
COPY backend/pyproject.toml ./backend/
WORKDIR /app/backend
RUN uv venv /app/backend/.venv
ENV PATH="/app/backend/.venv/bin:$PATH"
RUN uv pip install -e .

# Copy backend code
COPY backend/ ./

# Copy built frontend
WORKDIR /app
COPY --from=frontend-builder /app/frontend/.next/standalone ./frontend/
COPY --from=frontend-builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/frontend/public ./frontend/public
# Copy i18n message files (not included in standalone output due to dynamic imports)
COPY --from=frontend-builder /app/frontend/src/messages ./frontend/src/messages

# Create supervisord config
RUN mkdir -p /etc/supervisor/conf.d
COPY <<EOF /etc/supervisor/conf.d/supervisord.conf
[supervisord]
nodaemon=true
logfile=/dev/null
logfile_maxbytes=0
pidfile=/tmp/supervisord.pid

[program:backend]
command=/app/backend/.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 3001
directory=/app/backend
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:frontend]
command=node /app/frontend/server.js
directory=/app/frontend
environment=PORT="3000",HOSTNAME="0.0.0.0",BACKEND_URL="http://localhost:3001"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
EOF

# Create non-root user and data directory
RUN groupadd --gid 1000 wallet && \
    useradd --uid 1000 --gid wallet --shell /bin/bash wallet && \
    mkdir -p /data && \
    chown -R wallet:wallet /app /data

# Environment variables
ENV DATABASE_URL="sqlite+aiosqlite:////data/wallet.db"
ENV PYTHONUNBUFFERED=1
ENV APP_VERSION=$APP_VERSION
ENV GIT_SHA=$GIT_SHA

# Expose both ports
EXPOSE 3000 3001

# Create startup script with multiple commands
COPY <<'EOF' /app/start.sh
#!/bin/bash
set -e

cd /app/backend

init_database() {
    echo "Initializing database schema..."
    # Create tables via SQLAlchemy Base metadata
    python -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
import os
# Import Base and all models to register them
from app.orm import Base
import app.orm  # noqa: F401 - registers all models

async def create_tables():
    DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite+aiosqlite:////data/wallet.db')
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()

asyncio.run(create_tables())
"
    echo "Stamping alembic version..."
    alembic stamp head
}

case "${1:-run}" in
  run)
    # Demo mode: always reset to fresh data on startup
    if [ "${DEMO_MODE:-false}" = "true" ]; then
        echo "Demo mode detected - resetting to fresh demo data..."
        # Remove existing database to ensure clean state
        rm -f /data/wallet.db
        init_database
        python -m scripts.setup_demo
    elif [ ! -f /data/wallet.db ]; then
        # First run: initialize database
        init_database
    else
        # Existing database: run migrations
        echo "Running migrations..."
        alembic upgrade head
    fi
    echo "Starting services..."
    exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
    ;;
  migrate)
    if [ ! -f /data/wallet.db ]; then
        init_database
    else
        echo "Running migrations..."
        alembic upgrade head
    fi
    echo "Migrations complete."
    ;;
  seed)
    if [ ! -f /data/wallet.db ]; then
        init_database
    fi
    echo "Seeding database with sample data..."
    python -m scripts.seed --clear
    echo "Seeding complete."
    exit 0
    ;;
  demo-setup)
    if [ ! -f /data/wallet.db ]; then
        init_database
    fi
    echo "Setting up demo mode..."
    python -m scripts.setup_demo
    echo "Demo setup complete."
    exit 0
    ;;
  reset-password)
    if [ -z "$2" ] || [ -z "$3" ]; then
        echo "Usage: reset-password <username> <new_password>"
        echo ""
        echo "Example:"
        echo "  docker compose exec app reset-password admin newpassword123"
        echo "  docker compose run --rm app reset-password admin newpassword123"
        exit 1
    fi
    if [ ! -f /data/wallet.db ]; then
        echo "Error: Database not initialized. Run the app first to create a user."
        exit 1
    fi
    python -m scripts.reset_password "$2" "$3"
    exit $?
    ;;
  shell)
    exec /bin/bash
    ;;
  backend-only)
    if [ ! -f /data/wallet.db ]; then
        init_database
    else
        echo "Running migrations..."
        alembic upgrade head
    fi
    echo "Starting backend only..."
    exec uvicorn app.main:app --host 0.0.0.0 --port 3001
    ;;
  help)
    echo "Maxwell's Wallet Docker Commands:"
    echo ""
    echo "  run            Start the application (default)"
    echo "  migrate        Run database migrations only"
    echo "  seed           Seed database with sample data"
    echo "  demo-setup     Set up demo mode (seed + create demo backup)"
    echo "  reset-password Reset a user's password"
    echo "  shell          Open a bash shell"
    echo "  backend-only   Run backend API only (no frontend)"
    echo "  help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  docker compose up -d"
    echo "  docker compose run --rm app seed"
    echo "  docker compose run --rm app demo-setup"
    echo "  docker compose exec app reset-password <username> <newpassword>"
    echo "  docker compose run -it --rm app shell"
    ;;
  *)
    echo "Unknown command: $1"
    echo "Run 'docker run maxwells-wallet help' for available commands"
    exit 1
    ;;
esac
EOF
RUN chmod +x /app/start.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/health && curl -f http://localhost:3000 || exit 1

USER wallet
ENTRYPOINT ["/app/start.sh"]
CMD ["run"]
