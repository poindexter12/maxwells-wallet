#!/bin/bash
# Bootstrap script for deploying Maxwell's Wallet DEMO in an LXC container
#
# Deploys a demo instance with:
#   - SWAG reverse proxy
#   - Sample data pre-seeded
#   - Hourly data reset
#
# Prerequisites:
#   - LXC with nesting enabled (for Docker support)
#   - Ubuntu 22.04+ or Debian 12+
#
# Usage:
#   # On Proxmox, create LXC with nesting:
#   pct create 100 local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst \
#     --hostname maxwells-wallet \
#     --memory 2048 \
#     --cores 2 \
#     --rootfs local-lvm:8 \
#     --net0 name=eth0,bridge=vmbr0,ip=dhcp \
#     --features nesting=1
#
#   # Then inside the LXC:
#   curl -fsSL https://raw.githubusercontent.com/poindexter12/maxwells-wallet/main/deploy/swag-test/lxc-bootstrap.sh | bash
#
# Or clone and run:
#   git clone https://github.com/poindexter12/maxwells-wallet.git
#   cd maxwells-wallet/deploy/swag-test
#   ./lxc-bootstrap.sh

set -e

echo "==> Maxwell's Wallet LXC Bootstrap"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

# Install Docker if not present
if ! command -v docker &> /dev/null; then
  echo "==> Installing Docker..."
  apt-get update
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable docker
  systemctl start docker
  echo "==> Docker installed!"
else
  echo "==> Docker already installed"
fi

# Create deployment directory
DEPLOY_DIR="/opt/maxwells-wallet"
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# Download compose files if not present
if [ ! -f "docker-compose.yaml" ]; then
  echo "==> Downloading deployment files..."
  BASE_URL="https://raw.githubusercontent.com/poindexter12/maxwells-wallet/main/deploy/swag-test"
  curl -fsSL "$BASE_URL/docker-compose.yaml" -o docker-compose.yaml
  mkdir -p swag
  curl -fsSL "$BASE_URL/swag/nginx.conf" -o swag/nginx.conf
fi

# Create data directories
mkdir -p data

# Start the stack
echo "==> Starting Maxwell's Wallet with SWAG..."
docker compose up -d

echo ""
echo "==> Demo deployment complete!"
echo ""
echo "Access the app at: http://$(hostname -I | awk '{print $1}'):8080"
echo ""
echo "Demo mode is enabled:"
echo "  - Sample data is pre-seeded"
echo "  - Data resets every hour"
echo "  - Destructive operations are blocked"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f    # View logs"
echo "  docker compose restart    # Restart services"
echo "  docker compose down       # Stop services"
