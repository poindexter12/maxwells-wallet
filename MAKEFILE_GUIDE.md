# Makefile Quick Reference

## Setup & Installation

```bash
make setup              # First-time setup (installs deps + seeds DB)
make install            # Install all dependencies
make install-backend    # Install backend dependencies only
make install-frontend   # Install frontend dependencies only
make check-deps         # Verify all required tools are installed
```

## Running the App

```bash
make dev                # Start both backend and frontend servers
make backend            # Start backend server only (port 8000)
make frontend           # Start frontend server only (port 3000)
```

## Database Management

```bash
make db-init            # Initialize database (create tables)
make db-seed            # Seed database with sample data
make db-reset           # Reset database (delete + recreate + seed)
make db-migrate         # Create new database migration
make db-upgrade         # Apply pending migrations
```

## Build & Test

```bash
make build-frontend     # Build frontend for production
make test-backend       # Run backend tests
make lint-frontend      # Lint frontend code
```

## Maintenance

```bash
make clean              # Clean build artifacts and caches
make clean-all          # Clean everything (deps + DB + artifacts)
make status             # Check if services are running
```

## Help & Info

```bash
make help               # Show all available targets
make info               # Show project information
```

## Typical Workflows

### First Time Setup
```bash
make check-deps    # Verify dependencies installed
make setup         # Install and initialize everything
make dev           # Start development
```

### Daily Development
```bash
make dev           # Start both servers
# Work on your code
make status        # Check services are running
```

### Reset Everything
```bash
make db-reset      # Reset database with fresh sample data
make dev           # Restart servers
```

### After Pulling Changes
```bash
make install       # Update dependencies
make db-upgrade    # Apply new migrations
make dev           # Start servers
```

### Database Changes
```bash
# Edit models in backend/app/models.py
make db-migrate    # Create migration
make db-upgrade    # Apply migration
```

## Parallel Execution

The `make dev` command runs backend and frontend in parallel using `make -j2`. To stop both servers, use `Ctrl+C`.

For more control, run servers in separate terminals:
```bash
# Terminal 1
make backend

# Terminal 2
make frontend
```

## Environment Variables

The Makefile uses these directories:
- `BACKEND_DIR = backend`
- `FRONTEND_DIR = frontend`

Modify these in the Makefile if your directory structure differs.

## Troubleshooting

**Backend won't start:**
```bash
make clean
make install-backend
make db-reset
make backend
```

**Frontend won't start:**
```bash
cd frontend
rm -rf node_modules .next
cd ..
make install-frontend
make frontend
```

**Database issues:**
```bash
make db-reset       # Nuclear option - fresh start
```

**Check service status:**
```bash
make status
curl http://localhost:8000/health    # Backend health check
curl http://localhost:3000           # Frontend check
```
