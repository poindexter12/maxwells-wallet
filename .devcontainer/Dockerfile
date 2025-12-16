# Development container for Maxwell's Wallet
FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Install uv for Python package management
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# Add uv to PATH for all users
ENV PATH="/root/.local/bin:/home/vscode/.local/bin:${PATH}"

# Install SQLite (for development database)
RUN apt-get update && apt-get install -y \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*
