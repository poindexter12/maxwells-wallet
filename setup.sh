#!/bin/bash

# Finances - Setup Script
# Alternative to Makefile for first-time setup

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Finances - Personal Finance Tracker Setup${NC}"
echo ""

# Check dependencies
echo -e "${BLUE}Checking dependencies...${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗ Python 3 not found. Please install Python 3.11+${NC}"
    exit 1
fi

if ! command -v uv &> /dev/null; then
    echo -e "${RED}✗ uv not found. Install with: curl -LsSf https://astral.sh/uv/install.sh | sh${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm not found. Install Node.js from nodejs.org${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All dependencies found${NC}"
echo ""

# Install backend dependencies
echo -e "${BLUE}Installing backend dependencies...${NC}"
cd backend
uv venv
source .venv/bin/activate
uv pip install -e .
cd ..
echo -e "${GREEN}✓ Backend dependencies installed${NC}"
echo ""

# Install frontend dependencies
echo -e "${BLUE}Installing frontend dependencies...${NC}"
cd frontend
npm ci
cd ..
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
echo ""

# Initialize database
echo -e "${BLUE}Initializing database...${NC}"
cd backend
source .venv/bin/activate
python -c "import asyncio; from app.database import init_db; asyncio.run(init_db())"
cd ..
echo -e "${GREEN}✓ Database initialized${NC}"
echo ""

# Seed database
echo -e "${BLUE}Seeding database with sample data...${NC}"
cd backend
source .venv/bin/activate
python -m app.seed
cd ..
echo -e "${GREEN}✓ Database seeded${NC}"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Setup complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "Using Makefile:"
echo "  make dev          # Start both servers"
echo "  make backend      # Start backend only"
echo "  make frontend     # Start frontend only"
echo ""
echo "Or manually:"
echo "  Terminal 1: cd backend && source .venv/bin/activate && uv run uvicorn app.main:app --reload"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""
echo "Then open: ${BLUE}http://localhost:3000${NC}"
echo ""
