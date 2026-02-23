# Development container for Maxwell's Wallet
FROM mcr.microsoft.com/devcontainers/base:ubuntu@sha256:f0172faca68b6e932f17ce9fb607f7080b4bd81ce38afea2d60d833994ad2b01

# Install uv for Python package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# uv is already in /usr/local/bin via COPY --from above

# Install SQLite (for development database)
RUN apt-get update && apt-get install -y \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*
