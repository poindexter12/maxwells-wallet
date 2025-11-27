# {{project_name}} Backend

FastAPI backend with SQLModel, Alembic migrations, and uv for dependency management.

## Setup

### Prerequisites

- Python 3.11+
- [uv](https://github.com/astral-sh/uv) installed
- (Optional) [direnv](https://direnv.net/) for automatic environment management

### Installation

1. **Create virtual environment with uv:**
   ```bash
   uv venv
   ```

2. **Activate the virtual environment:**
   ```bash
   source .venv/bin/activate  # On Unix/macOS
   # or
   .venv\Scripts\activate     # On Windows
   ```

3. **Install dependencies:**
   ```bash
   uv pip install -e .
   ```

4. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

### Using direnv (Recommended)

If you have direnv installed:

1. **Allow direnv:**
   ```bash
   direnv allow
   ```

This will automatically:
- Activate the virtual environment when you cd into the directory
- Load environment variables from `.env`
- Deactivate when you leave the directory

## Running

### Development Server

```bash
{{constraints.commands.backend}}
```

The API will be available at `http://localhost:8000`

### Database Migrations

Create a new migration:
```bash
uv run alembic revision --autogenerate -m "description"
```

Run migrations:
```bash
uv run alembic upgrade head
```

## API Documentation

Once running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
