# Environment Separation Strategy

## Overview

AIRMAN Core uses a three-tier environment strategy for development, staging, and production. Each environment has:

- **Isolated data** (separate databases and Redis instances)
- **Environment-specific configuration** (.env files)
- **Docker Compose overrides** for each environment
- **Automated CI/CD pipelines** with GitHub Actions
- **Separate branches** with enforced workflows

---

## 🔧 Environment Structure

### Dev (`develop` branch)
- **Purpose**: Local development and feature testing
- **Database**: Local PostgreSQL (port 5433)
- **Redis**: Local Redis (port 6379)
- **API**: `http://localhost:3001`
- **Frontend**: `http://localhost:3000`
- **Features**:
  - Hot reload enabled
  - Database seeding enabled
  - Debug logging
  - No authentication enforcement on API

**Run locally:**
```bash
# Using dev configuration
docker-compose -f docker-compose.dev.yml up -d

# Or use default compose file (reads .env.dev)
docker-compose up -d
```

### Staging (`staging` branch)
- **Purpose**: Pre-production testing with production-like environment
- **Database**: Staging PostgreSQL instance
- **Redis**: Staging Redis instance with password
- **API**: `https://staging-api.airman.local`
- **Frontend**: `https://staging.airman.local`
- **Features**:
  - Closer to production config
  - No database seeding
  - Info-level logging
  - Full authentication enabled
  - Automated deployments on push

**Deploy:**
```bash
git checkout staging && git pull origin staging
# CI/CD pipeline triggers automatically
```

### Production (`main` branch)
- **Purpose**: Live user environment
- **Database**: Production PostgreSQL with backups
- **Redis**: Production Redis with persistence & memory limits
- **API**: `https://api.airman.com`
- **Frontend**: `https://airman.com`
- **Features**:
  - Highest security/performance settings
  - Persistent encrypted backups
  - Minimal logging (warn level only)
  - Environment protection rules
  - Manual approval required for deployments

**Deploy:**
```bash
git tag v1.0.0 && git push origin v1.0.0
# Manual approval required in GitHub Actions
```

---

## 📁 File Structure

```
AIRMAN-Core/
├── .env.example          # Template for all environments
├── .env.dev              # ✅ Safe to commit (dev secrets)
├── .env.staging          # ❌ Use GitHub Secrets for values
├── .env.prod             # ❌ Use GitHub Secrets for values
│
├── docker-compose.yml    # Default (dev)
├── docker-compose.dev.yml
├── docker-compose.staging.yml
├── docker-compose.prod.yml
│
├── .github/workflows/
│   ├── dev-build-test.yml         # Runs on develop branch
│   ├── staging-build-deploy.yml   # Runs on staging branch
│   └── prod-build-deploy.yml      # Runs on main branch (with approval)
│
├── backend/
│   └── .env.dev          # Backend-specific dev config
│
└── frontend/
    └── .env.dev          # Frontend-specific dev config
```

---

## 🚀 Setting Up Environments

### 1. Local Development (Dev)

```bash
# Clone repository
git clone git@github.com:saiprasadreddy33/AIRMAN-Core.git
cd AIRMAN-Core

# Ensure dev branch
git checkout develop

# Copy example env (already provided as .env.dev)
# Already available: .env.dev

# Start services
docker-compose -f docker-compose.dev.yml up -d

# Verify
docker-compose -f docker-compose.dev.yml ps
curl http://localhost:3001/health
```

### 2. Staging Environment (Cloud)

**Prerequisites:**
- Staging server with Docker & Docker Compose
- GitHub Secrets configured:
  - `STAGING_SERVER`: IP or domain
  - `STAGING_DEPLOY_KEY`: SSH private key for deployment
  - `STAGING_DB_PASSWORD`: Database password
  - `STAGING_REDIS_PASSWORD`: Redis password
  - `STAGING_JWT_KEY`: JWT secret key

**Deploy:**
```bash
# Push to staging branch (auto-deploys)
git checkout staging
git pull origin staging
# Make changes
git push origin staging

# CI/CD pipeline automatically:
# 1. Builds and runs tests
# 2. Creates Docker images
# 3. SSHes into staging server
# 4. Pulls images and updates containers
# 5. Runs health checks
# 6. Notifies Slack
```

### 3. Production Environment (Cloud)

**Prerequisites:**
- Production server with Docker & Docker Compose
- GitHub Secrets configured:
  - `PROD_SERVER`: IP or domain
  - `PROD_DEPLOY_KEY`: SSH private key for deployment
  - `PROD_DB_PASSWORD`: Database password (ENCRYPTED)
  - `PROD_REDIS_PASSWORD`: Redis password (ENCRYPTED)
  - `PROD_JWT_KEY`: JWT secret key (ENCRYPTED)
  - `SLACK_WEBHOOK`: Slack webhook for notifications

**Environment Protection:**
In GitHub repository settings:
1. Go to Settings → Branches
2. Add rule for `main` branch:
   - Require pull request reviews before merging
   - Require status checks to pass
   - Require branches to be up to date
3. Go to Settings → Environments → production
   - Enable "Required reviewers"
   - Configure approval conditions

**Deploy:**
```bash
# Option 1: Create release tag
git tag v1.0.0
git push origin v1.0.0

# Option 2: Merge to main (after PR approved)
git checkout main
git pull origin main
git merge --no-ff staging
git push origin main

# CI/CD pipeline:
# 1. Builds and runs comprehensive tests
# 2. Awaits manual approval (GitHub Actions)
# 3. Deploys to production server
# 4. Runs smoke tests
# 5. Notifies Slack of success/failure
```

---

## 🔐 Secrets Management

### Option 1: GitHub Secrets (Recommended)

```bash
# Set secrets in GitHub:
gh secret set STAGING_DB_PASSWORD -b "your-staging-password"
gh secret set PROD_DB_PASSWORD -b "your-prod-password"
gh secret set PROD_JWT_KEY -b "your-prod-jwt-key"
```

### Option 2: GitHub Environments

1. Settings → Environments → Create new:
   - Name: `staging`
   - Reviewers: (leave empty or add team leads)
   - Secrets: Add STAGING_* secrets

2. Name: `production`
   - Reviewers: Add required approvers
   - Secrets: Add PROD_* secrets

---

## 📊 Environment Comparison

| Aspect | Dev | Staging | Production |
|--------|-----|---------|------------|
| **Database Seed** | ✅ Yes | ❌ No | ❌ No |
| **Log Level** | DEBUG | INFO | WARN |
| **Environment Var** | `NODE_ENV=development` | `NODE_ENV=production` | `NODE_ENV=production` |
| **JWT Expiry** | 15 min | 30 min | 1 hour |
| **Health Checks** | None | Every 30s | Every 60s |
| **Auto-restart** | Unless stopped | Always | Always |
| **Volumes** | Host mounts | Docker volumes | Docker volumes + backups |
| **Backups** | None | Manual | Automated daily |
| **SSL/TLS** | No | Self-signed | Let's Encrypt |

---

## 🔄 Deployment Flow

```
Feature Branch (feature/*)
        ↓
    [Create PR to develop]
    ↓ (PR review)
    ↓ (CI tests pass)
Merge to develop
    ↓
[Deployes to Dev auto]
    ↓ (Verify in dev)
Create PR to staging
    ↓ (PR review)
    ↓ (CI tests pass)
Merge to staging
    ↓
[Deploy to Staging auto]
    ↓ (QA testing)
Create PR to main
    ↓ (Approval required)
    ↓ (Status checks pass)
Merge to main
    ↓
[Deploy to Production]
    ↓ (Manual approval in GitHub)
Production Live
```

---

## 🛠️ Useful Commands

### View environment config
```bash
# Dev
docker-compose -f docker-compose.dev.yml config | grep -A5 "environment:"

# Staging
docker-compose -f docker-compose.staging.yml config

# Prod
docker-compose -f docker-compose.prod.yml config
```

### Run with specific environment
```bash
# Using specific env file
docker-compose -f docker-compose.staging.yml --env-file .env.staging up -d

# Check what env vars are loaded
docker-compose -f docker-compose.staging.yml config | grep "ENVIRONMENT:"
```

### Database backups
```bash
# Dev (skip)
# Staging
docker-compose -f docker-compose.staging.yml exec postgres pg_dump -U airman_staging airman_staging > backup-staging-$(date +%Y%m%d).sql

# Prod
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U airman_prod airman_prod > backup-prod-$(date +%Y%m%d).sql
```

### View logs by environment
```bash
# Dev
docker-compose -f docker-compose.dev.yml logs -f api

# Staging
docker-compose -f docker-compose.staging.yml logs -f api --tail=100

# Prod
docker-compose -f docker-compose.prod.yml logs -f api --tail=50
```

---

## ✅ Validation Checklist

Before deploying to each environment:

### Dev
- [ ] All tests pass locally
- [ ] Linting passes
- [ ] Hot reload works

### Staging
- [ ] PR approved by 1+ reviewer
- [ ] All CI checks pass
- [ ] No database schema migrations pending
- [ ] QA testing scheduled

### Production
- [ ] PR approved by 2+ senior developers
- [ ] All CI checks pass
- [ ] Staging tests pass
- [ ] Release notes written
- [ ] Runbooks updated
- [ ] Incident response team notified
- [ ] Backup confirmed

---

## 🚨 Troubleshooting

### Dev environment won't start
```bash
# Clean everything
docker-compose -f docker-compose.dev.yml down -v

# Start fresh
docker-compose -f docker-compose.dev.yml up --build -d
```

### Staging/Prod deployment failed
```bash
# SSH into server
ssh -i ~/.ssh/deploy_key root@staging-server

# Check logs
docker-compose -f docker-compose.staging.yml logs -f

# Manually rollback
docker-compose -f docker-compose.staging.yml down
# Redeploy previous version
git checkout v1.0.0
```

### Environment variables not loading
```bash
# Check which env file is being used
docker-compose -f docker-compose.dev.yml config | grep "POSTGRES_USER:"

# Force specific env file
docker-compose -f docker-compose.dev.yml --env-file .env.dev up -d
```

---

## 📞 Support

For environment setup issues:
1. Check `.env.example` for required variables
2. Verify GitHub Secrets are set
3. Consult deployment logs in GitHub Actions
4. Contact DevOps team for server access issues
