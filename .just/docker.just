# Docker recipes

# Docker compose commands
COMPOSE_DEV := "docker compose -f docker-compose.dev.yaml"
COMPOSE_DEMO := "docker compose -f docker-compose.demo.yaml"

# Build and start Docker container (dev)
all: build up

# Build and start Docker with pseudo locale for i18n QA
with-pseudo: build-pseudo up

# Build and start Docker in demo mode (builds from source)
with-demo:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    spin "Building Docker image..." {{ COMPOSE_DEV }} build
    style 12 "Starting Docker container in demo mode..."
    DEMO_MODE=true {{ COMPOSE_DEV }} up -d
    style 2 "Container started in demo mode."
    echo ""
    style 11 "Demo mode enabled - data resets on restart"
    echo "Frontend: http://localhost:3000"
    echo "Backend:  http://localhost:3001"
    echo "Login: maxwell / wallet"

# Build Docker image from source
build:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    spin "Building Docker image..." {{ COMPOSE_DEV }} build
    style 2 "Docker image built."

# Build Docker image (no cache)
build-force:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    spin "Building Docker image (no cache)..." {{ COMPOSE_DEV }} build --no-cache
    style 2 "Docker image built."

# Build Docker image with pseudo locale enabled (no cache)
build-pseudo:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    spin "Building Docker image with pseudo locale (no cache)..." \
        env ENABLE_PSEUDO=true {{ COMPOSE_DEV }} build --no-cache
    style 2 "Docker image built with pseudo locale."

# Start Docker container
up:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Starting Docker container..."
    {{ COMPOSE_DEV }} up -d
    style 2 "Container started."
    echo ""
    echo "Frontend: http://localhost:3000"
    echo "Backend:  http://localhost:3001"

# Stop Docker container
down:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Stopping Docker container..."
    {{ COMPOSE_DEV }} down
    style 2 "Container stopped."

# View Docker logs
logs:
    {{ COMPOSE_DEV }} logs -f

# Open shell in Docker container
shell:
    {{ COMPOSE_DEV }} exec maxwells-wallet /bin/bash

# Remove Docker containers and volumes (DESTRUCTIVE)
clean:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 1 "WARNING: This will remove all Docker containers and volumes."
    if confirm "Remove Docker containers and volumes?" false; then
        {{ COMPOSE_DEV }} down -v
        style 2 "Docker containers and volumes removed."
    else
        style 12 "Docker clean cancelled."
    fi

# Seed database in Docker with sample data
seed:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Seeding database..."
    {{ COMPOSE_DEV }} run --rm maxwells-wallet seed
    style 2 "Database seeded."

# Run database migrations in Docker
migrate:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Running migrations..."
    {{ COMPOSE_DEV }} run --rm maxwells-wallet migrate
    style 2 "Migrations complete."

# Start demo from registry image (CI/prod only, requires published image)
demo-up:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Starting Docker container in demo mode (from registry)..."
    {{ COMPOSE_DEMO }} up -d
    style 2 "Container started in demo mode."
    echo ""
    style 11 "Demo mode enabled - data resets hourly"
    echo "Frontend: http://localhost:3000"
    echo "Backend:  http://localhost:3001"

# Seed demo data (for registry image)
demo-seed:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Setting up demo data..."
    {{ COMPOSE_DEMO }} run --rm maxwells-wallet demo-setup
    style 2 "Demo data seeded."
