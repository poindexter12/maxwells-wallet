# All-in-One Dockerfile for Maxwell's Wallet
# Runs both FastAPI backend and Next.js frontend in a single container

FROM node:24-slim AS frontend-builder

# Build arg to enable pseudo locale (set ENABLE_PSEUDO=true in .env or pass --build-arg)
ARG ENABLE_PSEUDO=false

WORKDIR /app/frontend

# Install dependencies
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

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
FROM python:3.12-slim

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
user=root
logfile=/var/log/supervisor/supervisord.log
pidfile=/var/run/supervisord.pid

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

# Create data directory for external volume mount
RUN mkdir -p /data

# Environment variables
ENV DATABASE_URL="sqlite+aiosqlite:////data/wallet.db"
ENV PYTHONUNBUFFERED=1

# Expose both ports
EXPOSE 3000 3001

# Create startup script with multiple commands
COPY <<'EOF' /app/start.sh
#!/bin/bash
set -e

cd /app/backend

init_database() {
    echo "Initializing database schema..."
    # Create tables via SQLModel metadata (not alembic migrations)
    python -c "
import asyncio
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine
import os
# Import all models to register them
from app.models import *

async def create_tables():
    DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite+aiosqlite:////data/wallet.db')
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    await engine.dispose()

asyncio.run(create_tables())
"
    echo "Stamping alembic version..."
    alembic stamp head
}

case "${1:-run}" in
  run)
    # Initialize if fresh database
    if [ ! -f /data/wallet.db ]; then
        init_database
    else
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
    ;;
  demo-setup)
    if [ ! -f /data/wallet.db ]; then
        init_database
    fi
    echo "Setting up demo mode..."
    python -m scripts.setup_demo
    echo "Demo setup complete."
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
    echo "  run          Start the application (default)"
    echo "  migrate      Run database migrations only"
    echo "  seed         Seed database with sample data"
    echo "  demo-setup   Set up demo mode (seed + create demo backup)"
    echo "  shell        Open a bash shell"
    echo "  backend-only Run backend API only (no frontend)"
    echo "  help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  docker compose up -d"
    echo "  docker compose run --rm maxwells-wallet seed"
    echo "  docker compose run --rm maxwells-wallet demo-setup"
    echo "  docker compose run -it --rm maxwells-wallet shell"
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

ENTRYPOINT ["/app/start.sh"]
CMD ["run"]
