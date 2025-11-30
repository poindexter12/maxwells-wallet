# All-in-One Dockerfile for Maxwell's Wallet
# Runs both FastAPI backend and Next.js frontend in a single container

FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

# Install dependencies
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

# Copy frontend source and build
COPY frontend/ ./
ENV BACKEND_URL=http://localhost:8000
RUN npm run build

# Final stage: Python + Node runtime
FROM python:3.11-slim

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

# Create supervisord config
RUN mkdir -p /etc/supervisor/conf.d
COPY <<EOF /etc/supervisor/conf.d/supervisord.conf
[supervisord]
nodaemon=true
user=root
logfile=/var/log/supervisor/supervisord.log
pidfile=/var/run/supervisord.pid

[program:backend]
command=/app/backend/.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
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
environment=PORT="3000",HOSTNAME="0.0.0.0",BACKEND_URL="http://localhost:8000"
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
ENV DATABASE_URL="sqlite+aiosqlite:///data/wallet.db"
ENV PYTHONUNBUFFERED=1

# Expose both ports
EXPOSE 3000 8000

# Create startup script with multiple commands
COPY <<'EOF' /app/start.sh
#!/bin/bash
set -e

cd /app/backend

case "${1:-run}" in
  run)
    echo "Running migrations..."
    alembic upgrade head
    echo "Starting services..."
    exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
    ;;
  migrate)
    echo "Running migrations..."
    alembic upgrade head
    echo "Migrations complete."
    ;;
  seed)
    echo "Running migrations..."
    alembic upgrade head
    echo "Seeding database..."
    python -m app.seed
    echo "Seeding complete."
    ;;
  shell)
    exec /bin/bash
    ;;
  backend-only)
    echo "Running migrations..."
    alembic upgrade head
    echo "Starting backend only..."
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000
    ;;
  help)
    echo "Maxwell's Wallet Docker Commands:"
    echo ""
    echo "  run          Start the application (default)"
    echo "  migrate      Run database migrations only"
    echo "  seed         Run migrations and seed sample data"
    echo "  shell        Open a bash shell"
    echo "  backend-only Run backend API only (no frontend)"
    echo "  help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  docker run maxwells-wallet"
    echo "  docker run maxwells-wallet seed"
    echo "  docker run -it maxwells-wallet shell"
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
    CMD curl -f http://localhost:8000/health && curl -f http://localhost:3000 || exit 1

ENTRYPOINT ["/app/start.sh"]
CMD ["run"]
