# SWAG Demo Deployment

Maxwell's Wallet behind [SWAG](https://docs.linuxserver.io/general/swag/) reverse proxy in **demo mode**, targeting single-LXC homelab deployment.

**Demo Mode Features:**
- Pre-seeded with sample transactions and budgets
- Resets to clean demo data every hour
- Destructive operations blocked (purge, bulk delete)
- "Demo Mode" banner in UI

## Local Testing

```bash
cd deploy/swag-test

make up          # Start local demo (http://localhost:8888)
make cloudflare  # Start with Cloudflare tunnel (prompts for token)
make logs        # View logs
make down        # Stop everything
make help        # Show all commands
```

### Docker-in-Docker (simulates LXC)

Full isolation - simulates Docker running inside an LXC:

```bash
cd deploy/swag-test
docker compose -f docker-compose.dind.yaml up -d

# Shell into DinD to inspect:
docker exec -it dind-swag-test sh
docker ps  # see SWAG + app

# Access at http://localhost:8888
```

## Homelab LXC Deployment

### Create LXC (Proxmox)

```bash
# Create Ubuntu LXC with Docker nesting enabled
pct create 100 local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst \
  --hostname maxwells-wallet \
  --memory 2048 \
  --cores 2 \
  --rootfs local-lvm:8 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --features nesting=1

pct start 100
```

### Bootstrap (inside LXC)

One-liner:
```bash
curl -fsSL https://raw.githubusercontent.com/poindexter12/maxwells-wallet/main/deploy/swag-test/lxc-bootstrap.sh | bash
```

Or manually:
```bash
git clone https://github.com/poindexter12/maxwells-wallet.git
cd maxwells-wallet/deploy/swag-test
./lxc-bootstrap.sh
```

## Files

| File | Purpose |
|------|---------|
| `Makefile` | Local make commands (up, down, cloudflare, etc.) |
| `docker-compose.yaml` | SWAG + app stack |
| `docker-compose.dind.yaml` | DinD wrapper for isolated testing |
| `swag/nginx.conf` | NGINX reverse proxy config |
| `lxc-bootstrap.sh` | LXC setup script (installs Docker, deploys stack) |
| `.env.example` | Template for Cloudflare token |

## Adding Cloudflare Tunnel

```bash
cd deploy/swag-test
make cloudflare   # Prompts for token, then starts everything
```

Or manually:
1. Create tunnel at [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → Networks → Tunnels
2. Configure public hostname to point to: `http://swag:80`
3. Save token: `echo "CLOUDFLARE_TUNNEL_TOKEN=your-token" > .env`
4. Start: `make cloudflare`

## Ports

| Port | Service | Exposed |
|------|---------|---------|
| 8888 | SWAG HTTP | Yes |
| 8443 | SWAG HTTPS | Yes |
| 3000 | Frontend | Internal |
| 3001 | Backend API | Internal |

## Troubleshooting

```bash
# Check container status
docker compose ps

# View logs
docker compose logs -f
docker compose logs swag
docker compose logs app

# Restart
docker compose restart

# Full reset
docker compose down -v
docker compose up -d
```
