# SaaS Migration Plan

This document outlines the technical requirements and implementation plan for converting Maxwell's Wallet from a single-user personal finance tracker to a multi-tenant SaaS application.

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Phase 1: Foundation](#phase-1-foundation)
- [Phase 2: Multi-Tenancy](#phase-2-multi-tenancy)
- [Phase 3: Infrastructure](#phase-3-infrastructure)
- [Phase 4: Billing & Onboarding](#phase-4-billing--onboarding)
- [Phase 5: Operations](#phase-5-operations)
- [Database Schema Changes](#database-schema-changes)
- [API Changes](#api-changes)
- [Security Considerations](#security-considerations)
- [Deployment Architecture](#deployment-architecture)

---

## Architecture Overview

### Current State
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Next.js   │────▶│   FastAPI   │────▶│   SQLite    │
│  Frontend   │     │   Backend   │     │  Database   │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Target State
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Next.js   │────▶│   FastAPI   │────▶│ PostgreSQL  │
│  Frontend   │     │   Backend   │     │    (RLS)    │
│    (CDN)    │     │ (Multiple)  │     └─────────────┘
└─────────────┘     └──────┬──────┘            │
                          │              ┌─────▼─────┐
                    ┌─────▼─────┐        │   Redis   │
                    │   Redis   │        │  (Cache)  │
                    │ (Sessions)│        └───────────┘
                    └───────────┘
                          │
                    ┌─────▼─────┐     ┌─────────────┐
                    │    S3     │     │   Celery    │
                    │ (Uploads) │     │  (Workers)  │
                    └───────────┘     └─────────────┘
```

### Multi-Tenancy Strategy: PostgreSQL Row-Level Security (RLS)

**Why RLS over application-level filtering:**
- Database enforces isolation - impossible to accidentally leak data
- Simpler application code - no need to add `user_id` filter to every query
- Works with any ORM/raw SQL
- Can be audited independently of application code

**How it works:**
1. Every request sets `current_user_id` on the database connection
2. RLS policies automatically filter all SELECT/INSERT/UPDATE/DELETE
3. Application code remains clean - just write normal queries

---

## Phase 1: Foundation

### 1.1 PostgreSQL Migration
**Priority: Critical | Effort: Medium**

- [ ] Add PostgreSQL to docker-compose for local development
- [ ] Update SQLModel/SQLAlchemy connection configuration
- [ ] Create Alembic migration for PostgreSQL-specific types
- [ ] Test all existing queries against PostgreSQL
- [ ] Update CI/CD to test against PostgreSQL
- [ ] Document local PostgreSQL setup

**Technical Notes:**
```python
# database.py changes
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://...")

# Connection pooling for production
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True
)
```

### 1.2 Redis Integration
**Priority: Critical | Effort: Medium**

- [ ] Add Redis to docker-compose
- [ ] Create Redis connection manager
- [ ] Implement session storage backend
- [ ] Implement caching layer for reports
- [ ] Add cache invalidation on data changes
- [ ] Rate limiting middleware

**Cache Strategy:**
| Endpoint | TTL | Invalidation |
|----------|-----|--------------|
| `/reports/monthly-summary` | 5 min | On transaction change |
| `/reports/trends` | 10 min | On transaction change |
| `/reports/top-merchants` | 10 min | On transaction change |
| `/tags/buckets` | 1 hour | On tag change |
| `/reports/filter-options` | 1 hour | On transaction change |

**Implementation:**
```python
# cache.py
from redis import asyncio as aioredis

class CacheManager:
    def __init__(self, redis_url: str):
        self.redis = aioredis.from_url(redis_url)

    async def get_or_set(self, key: str, ttl: int, factory):
        cached = await self.redis.get(key)
        if cached:
            return json.loads(cached)
        result = await factory()
        await self.redis.setex(key, ttl, json.dumps(result))
        return result

    async def invalidate_user_cache(self, user_id: int):
        pattern = f"user:{user_id}:*"
        async for key in self.redis.scan_iter(pattern):
            await self.redis.delete(key)
```

### 1.3 Environment Configuration
**Priority: Critical | Effort: Low**

- [ ] Create configuration management system (pydantic-settings)
- [ ] Define all environment variables
- [ ] Create `.env.example` template
- [ ] Separate configs for dev/staging/production
- [ ] Secrets management strategy (AWS Secrets Manager, Vault, etc.)

**Environment Variables:**
```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://localhost:6379/0
REDIS_SESSION_DB=1

# Auth
JWT_SECRET_KEY=<random-256-bit-key>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Storage
S3_BUCKET=maxwells-wallet-uploads
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=...
FROM_EMAIL=noreply@maxwellswallet.com

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_MONTHLY=price_...
STRIPE_PRICE_ID_YEARLY=price_...

# Application
APP_ENV=production
APP_URL=https://app.maxwellswallet.com
CORS_ORIGINS=https://maxwellswallet.com,https://app.maxwellswallet.com
```

---

## Phase 2: Multi-Tenancy

### 2.1 User Model & Authentication
**Priority: Critical | Effort: High**

- [ ] Create User model with secure password hashing
- [ ] Implement registration endpoint with email verification
- [ ] Implement login endpoint (JWT + refresh tokens)
- [ ] Implement password reset flow
- [ ] Implement logout (token blacklist in Redis)
- [ ] Add authentication middleware
- [ ] Create `/auth/me` endpoint for current user
- [ ] Implement OAuth2 providers (Google, optional)

**User Model:**
```python
class User(BaseModel, table=True):
    __tablename__ = "users"

    email: str = Field(unique=True, index=True)
    password_hash: str
    name: Optional[str] = None

    # Status
    is_active: bool = Field(default=True)
    is_verified: bool = Field(default=False)
    verified_at: Optional[datetime] = None

    # Subscription
    stripe_customer_id: Optional[str] = None
    subscription_status: str = Field(default="trial")  # trial, active, past_due, canceled
    subscription_ends_at: Optional[datetime] = None

    # Settings
    timezone: str = Field(default="America/New_York")
    currency: str = Field(default="USD")

    # Security
    last_login_at: Optional[datetime] = None
    failed_login_attempts: int = Field(default=0)
    locked_until: Optional[datetime] = None
```

**Auth Endpoints:**
```
POST /api/v1/auth/register     - Create account
POST /api/v1/auth/login        - Get tokens
POST /api/v1/auth/refresh      - Refresh access token
POST /api/v1/auth/logout       - Invalidate tokens
POST /api/v1/auth/forgot       - Request password reset
POST /api/v1/auth/reset        - Reset password with token
POST /api/v1/auth/verify       - Verify email
GET  /api/v1/auth/me           - Get current user
```

### 2.2 Row-Level Security Implementation
**Priority: Critical | Effort: High**

- [ ] Add `user_id` column to all tenant tables
- [ ] Create RLS policies for each table
- [ ] Implement connection-level user context
- [ ] Create database migration for RLS setup
- [ ] Test RLS policies thoroughly
- [ ] Add RLS bypass for admin operations

**Migration Script:**
```sql
-- Enable RLS on all tenant tables
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_formats ENABLE ROW LEVEL SECURITY;

-- Create policies (example for transactions)
CREATE POLICY transactions_isolation ON transactions
    USING (user_id = current_setting('app.current_user_id')::int);

CREATE POLICY transactions_insert ON transactions
    FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id')::int);

-- Repeat for all tables...
```

**Connection Middleware:**
```python
# middleware/tenant.py
from fastapi import Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession

async def set_tenant_context(
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Set the current user ID on the database connection for RLS."""
    await session.execute(
        text(f"SET app.current_user_id = '{current_user.id}'")
    )
    return current_user
```

### 2.3 Frontend Authentication
**Priority: Critical | Effort: Medium**

- [ ] Create login/register pages
- [ ] Implement JWT token storage (httpOnly cookies preferred)
- [ ] Add auth context provider
- [ ] Create protected route wrapper
- [ ] Add token refresh logic
- [ ] Implement logout functionality
- [ ] Add loading states during auth checks

**Auth Context:**
```typescript
// contexts/AuthContext.tsx
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}
```

**Protected Routes:**
```typescript
// middleware.ts (Next.js)
export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token');

  if (!token && !request.nextUrl.pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### 2.4 Data Migration Tool
**Priority: High | Effort: Medium**

- [ ] Create import tool for existing single-user data
- [ ] Map existing data to new user
- [ ] Handle ID remapping for foreign keys
- [ ] Validate data integrity post-migration
- [ ] Create rollback capability

---

## Phase 3: Infrastructure

### 3.1 File Storage (S3)
**Priority: High | Effort: Medium**

- [ ] Create S3 bucket with appropriate permissions
- [ ] Implement file upload service
- [ ] Generate presigned URLs for uploads
- [ ] Add file type validation
- [ ] Implement virus scanning (optional)
- [ ] Set up lifecycle policies for cleanup

**Upload Flow:**
```
1. Frontend requests presigned URL from backend
2. Backend generates presigned URL with user_id in path
3. Frontend uploads directly to S3
4. Frontend notifies backend of completed upload
5. Backend processes file (CSV import)
```

**Implementation:**
```python
# services/storage.py
import boto3
from botocore.config import Config

class StorageService:
    def __init__(self):
        self.s3 = boto3.client('s3', config=Config(signature_version='s3v4'))
        self.bucket = settings.S3_BUCKET

    def generate_upload_url(self, user_id: int, filename: str) -> dict:
        key = f"uploads/{user_id}/{uuid4()}/{filename}"
        url = self.s3.generate_presigned_url(
            'put_object',
            Params={'Bucket': self.bucket, 'Key': key},
            ExpiresIn=3600
        )
        return {"upload_url": url, "key": key}

    async def get_file(self, key: str) -> bytes:
        response = self.s3.get_object(Bucket=self.bucket, Key=key)
        return response['Body'].read()
```

### 3.2 Background Jobs (Celery)
**Priority: High | Effort: Medium**

- [ ] Set up Celery with Redis broker
- [ ] Create task for CSV import processing
- [ ] Create task for scheduled report generation
- [ ] Create task for email sending
- [ ] Implement job status tracking
- [ ] Add retry logic and dead letter queue
- [ ] Set up Celery beat for scheduled tasks

**Task Examples:**
```python
# tasks/imports.py
from celery import Celery

app = Celery('tasks', broker=settings.REDIS_URL)

@app.task(bind=True, max_retries=3)
def process_csv_import(self, user_id: int, file_key: str, format_type: str):
    try:
        # Download file from S3
        # Parse CSV
        # Insert transactions (with user_id)
        # Send completion email
        pass
    except Exception as e:
        self.retry(exc=e, countdown=60)

@app.task
def send_weekly_summary(user_id: int):
    # Generate report
    # Send email
    pass
```

### 3.3 Email Service
**Priority: High | Effort: Low**

- [ ] Set up email provider (SendGrid/Postmark/SES)
- [ ] Create email templates (HTML + plain text)
- [ ] Implement transactional email sending
- [ ] Add email logging/tracking
- [ ] Set up unsubscribe handling

**Email Templates Needed:**
| Template | Trigger |
|----------|---------|
| Welcome | Registration |
| Email Verification | Registration |
| Password Reset | Forgot password |
| Import Complete | CSV processed |
| Weekly Summary | Scheduled |
| Budget Alert | Threshold exceeded |
| Payment Failed | Stripe webhook |
| Subscription Canceled | Stripe webhook |

### 3.4 Rate Limiting
**Priority: High | Effort: Low**

- [ ] Implement rate limiting middleware
- [ ] Configure limits per endpoint type
- [ ] Store rate limit counters in Redis
- [ ] Add rate limit headers to responses
- [ ] Create bypass for premium tiers

**Rate Limits:**
| Endpoint Type | Limit |
|---------------|-------|
| Auth (login/register) | 5/min |
| API (general) | 100/min |
| Imports | 10/hour |
| Reports | 60/min |

---

## Phase 4: Billing & Onboarding

### 4.1 Stripe Integration
**Priority: High | Effort: High**

- [ ] Set up Stripe account and products
- [ ] Create subscription plans (monthly/yearly)
- [ ] Implement checkout session creation
- [ ] Handle Stripe webhooks
- [ ] Implement subscription management (upgrade/downgrade/cancel)
- [ ] Add billing portal redirect
- [ ] Handle failed payments
- [ ] Implement trial period logic

**Pricing Tiers (Example):**
| Tier | Price | Limits |
|------|-------|--------|
| Trial | Free (14 days) | 100 transactions |
| Basic | $5/mo | 1,000 transactions/mo, 1 account |
| Pro | $12/mo | Unlimited transactions, 10 accounts, API access |
| Family | $20/mo | Pro + 5 family members |

**Webhook Events to Handle:**
```python
# routers/webhooks.py
STRIPE_EVENTS = {
    'checkout.session.completed': handle_checkout_complete,
    'customer.subscription.created': handle_subscription_created,
    'customer.subscription.updated': handle_subscription_updated,
    'customer.subscription.deleted': handle_subscription_deleted,
    'invoice.paid': handle_invoice_paid,
    'invoice.payment_failed': handle_payment_failed,
}
```

### 4.2 Onboarding Flow
**Priority: Medium | Effort: Medium**

- [ ] Create welcome wizard component
- [ ] Add account setup step (name, timezone, currency)
- [ ] Add first import tutorial
- [ ] Add bucket/category setup helper
- [ ] Track onboarding progress
- [ ] Send onboarding emails

**Onboarding Steps:**
1. Welcome + account basics
2. Connect your first account (import CSV)
3. Review and categorize transactions
4. Set up budget buckets
5. Dashboard tour

### 4.3 Feature Flags
**Priority: Medium | Effort: Low**

- [ ] Implement feature flag system
- [ ] Create flags for tier-gated features
- [ ] Add flag checking to frontend
- [ ] Add flag checking to backend
- [ ] Admin UI for flag management

**Feature Flags:**
```python
FEATURES = {
    'api_access': ['pro', 'family'],
    'scheduled_reports': ['pro', 'family'],
    'multiple_accounts': ['pro', 'family'],
    'family_sharing': ['family'],
    'csv_export': ['basic', 'pro', 'family'],
    'advanced_charts': ['pro', 'family'],
}
```

---

## Phase 5: Operations

### 5.1 Monitoring & Observability
**Priority: High | Effort: Medium**

- [ ] Set up error tracking (Sentry)
- [ ] Implement structured logging
- [ ] Add request tracing (OpenTelemetry)
- [ ] Create health check endpoints
- [ ] Set up uptime monitoring
- [ ] Create operational dashboard
- [ ] Set up alerting rules

**Health Endpoints:**
```
GET /health          - Basic liveness
GET /health/ready    - Readiness (DB, Redis, S3)
GET /health/metrics  - Prometheus metrics
```

### 5.2 Admin Dashboard
**Priority: Medium | Effort: High**

- [ ] Create admin authentication (separate from user auth)
- [ ] User management (view, disable, impersonate)
- [ ] Subscription management
- [ ] System metrics dashboard
- [ ] Import/export logs
- [ ] Feature flag management
- [ ] Announcement/maintenance mode

### 5.3 Compliance & Security
**Priority: High | Effort: Medium**

- [ ] Implement data export (GDPR)
- [ ] Implement account deletion (GDPR)
- [ ] Create privacy policy
- [ ] Create terms of service
- [ ] Add audit logging for sensitive operations
- [ ] Implement session management (view/revoke)
- [ ] Add 2FA support (optional)
- [ ] Security headers middleware
- [ ] SQL injection protection (already via ORM)
- [ ] XSS protection (React handles this)
- [ ] CSRF protection for forms

**Audit Events to Log:**
- Login/logout
- Password change
- Email change
- Subscription change
- Data export
- Account deletion
- Admin impersonation

### 5.4 Documentation
**Priority: Medium | Effort: Medium**

- [ ] API documentation (OpenAPI/Swagger)
- [ ] User documentation/help center
- [ ] Developer documentation (for API access tier)
- [ ] Changelog/release notes
- [ ] Status page

---

## Database Schema Changes

### New Tables

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),

    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP,

    stripe_customer_id VARCHAR(255),
    subscription_status VARCHAR(50) DEFAULT 'trial',
    subscription_ends_at TIMESTAMP,

    timezone VARCHAR(50) DEFAULT 'America/New_York',
    currency VARCHAR(3) DEFAULT 'USD',

    last_login_at TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email verification tokens
CREATE TABLE email_verification_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens (for JWT rotation)
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id INTEGER,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Modified Tables (add user_id)

```sql
-- Add user_id to all tenant tables
ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE tags ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE budgets ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE dashboard_widgets ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE category_rules ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE recurring_patterns ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE merchant_aliases ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE saved_filters ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE import_batches ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE import_formats ADD COLUMN user_id INTEGER REFERENCES users(id);

-- Add indexes
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_tags_user_id ON tags(user_id);
-- ... etc
```

---

## API Changes

### New Endpoints

```
# Auth
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
POST   /api/v1/auth/verify-email
GET    /api/v1/auth/me

# User Settings
GET    /api/v1/user/settings
PATCH  /api/v1/user/settings
POST   /api/v1/user/change-password
DELETE /api/v1/user/account

# Billing
POST   /api/v1/billing/checkout
GET    /api/v1/billing/portal
GET    /api/v1/billing/subscription
POST   /api/v1/billing/webhook (Stripe)

# Data Export
POST   /api/v1/export/request
GET    /api/v1/export/download/:id
```

### Authentication Requirement

All existing endpoints (except auth) require authentication:

```python
# Before
@router.get("/transactions")
async def list_transactions(session: AsyncSession = Depends(get_session)):
    ...

# After
@router.get("/transactions")
async def list_transactions(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)  # Added
):
    # RLS handles filtering automatically
    ...
```

---

## Security Considerations

### Authentication Security
- [ ] Password hashing with bcrypt (cost factor 12+)
- [ ] JWT with short expiry (15-30 min)
- [ ] Refresh token rotation
- [ ] Rate limiting on auth endpoints
- [ ] Account lockout after failed attempts
- [ ] Secure password reset flow (time-limited tokens)

### API Security
- [ ] HTTPS only (HSTS header)
- [ ] CORS restricted to known origins
- [ ] Content Security Policy headers
- [ ] Request size limits
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries via ORM)
- [ ] XSS prevention (React escaping + CSP)

### Data Security
- [ ] Encryption at rest (PostgreSQL TDE or disk encryption)
- [ ] Encryption in transit (TLS 1.3)
- [ ] Sensitive data masking in logs
- [ ] PII handling compliance
- [ ] Regular security audits

---

## Deployment Architecture

### Production Setup

```
                        ┌─────────────┐
                        │ Cloudflare  │
                        │    (CDN)    │
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │   Vercel    │
                        │  (Frontend) │
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │ API Gateway │
                        │  (Rate Lim) │
                        └──────┬──────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
       ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
       │   FastAPI   │  │   FastAPI   │  │   FastAPI   │
       │  Instance 1 │  │  Instance 2 │  │  Instance N │
       └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
              │                │                │
              └────────────────┼────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
  ┌──────▼──────┐       ┌──────▼──────┐       ┌──────▼──────┐
  │ PostgreSQL  │       │    Redis    │       │     S3      │
  │   (Primary) │       │  (Cluster)  │       │  (Uploads)  │
  └──────┬──────┘       └─────────────┘       └─────────────┘
         │
  ┌──────▼──────┐
  │ PostgreSQL  │
  │  (Replica)  │
  └─────────────┘
```

### Hosting Options

| Component | Recommended | Alternative |
|-----------|-------------|-------------|
| Frontend | Vercel | Cloudflare Pages |
| Backend | Railway / Render | AWS ECS, Fly.io |
| Database | Neon / Supabase | AWS RDS, Railway |
| Redis | Upstash | Railway, AWS ElastiCache |
| Storage | Cloudflare R2 | AWS S3, Backblaze B2 |
| Email | Resend / Postmark | SendGrid, AWS SES |
| Monitoring | Sentry + Grafana | Datadog |

### Estimated Costs (starting)

| Service | Monthly Cost |
|---------|--------------|
| Backend hosting (2 instances) | $20-40 |
| PostgreSQL (managed) | $15-25 |
| Redis (managed) | $10-15 |
| S3/R2 storage | $5-10 |
| Email (transactional) | $10-20 |
| Monitoring | $0-30 |
| Domain + SSL | $2-5 |
| **Total** | **$60-145/mo** |

---

## Implementation Timeline

### Phase 1: Foundation (2-3 weeks)
- PostgreSQL migration
- Redis integration
- Environment configuration

### Phase 2: Multi-Tenancy (3-4 weeks)
- User model & authentication
- RLS implementation
- Frontend auth
- Data migration tool

### Phase 3: Infrastructure (2-3 weeks)
- S3 file storage
- Background jobs
- Email service
- Rate limiting

### Phase 4: Billing & Onboarding (2-3 weeks)
- Stripe integration
- Onboarding flow
- Feature flags

### Phase 5: Operations (2-3 weeks)
- Monitoring & observability
- Admin dashboard
- Compliance & security
- Documentation

**Total Estimated Time: 11-16 weeks**

---

## Success Metrics

### Technical
- API response time < 200ms (p95)
- Uptime > 99.9%
- Zero data leaks between tenants
- < 1% error rate

### Business
- User registration to first import < 5 minutes
- Trial to paid conversion > 5%
- Monthly churn < 3%
- NPS > 40

---

## Open Questions

1. **Pricing model**: Per-user, per-transaction, or flat tier?
2. **Family sharing**: How to implement shared access?
3. **API access**: Public API for pro tier? Rate limits?
4. **Data retention**: How long to keep deleted user data?
5. **Bank integrations**: Plaid for automatic sync?
6. **Mobile app**: PWA sufficient or native needed?
