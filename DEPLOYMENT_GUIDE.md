# 🚀 AIRMAN Core - Environment Separation & Deployment Guide

Complete documentation for managing development, staging, and production environments with proper secrets management and rollback procedures.

---

## 📚 Documentation Index

### Environment Management
- **[ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md)** - Complete environment configuration guide
  - Dev/Staging/Prod environment specifications
  - How to set up each environment
  - Environment comparison matrix
  - Troubleshooting

### Secrets & Security
- **[SECRETS_MANAGEMENT.md](SECRETS_MANAGEMENT.md)** - Detailed secrets handling
  - Secret categories and locations
  - Setup checklist for each environment
  - Rotation policies
  - Compromise response procedures
  - Access control matrix
  - CI/CD secret injection

### Deployment & Rollback
- **[ROLLBACK_STRATEGY.md](ROLLBACK_STRATEGY.md)** - Automated and manual rollback
  - Rollback scenarios (4 types)
  - Automated health-check rollback
  - Manual rollback procedures (4 options)
  - Emergency rollback script
  - RTO/RPO matrix
  - Testing schedule

### GitHub CI/CD
- **[GITHUB_SETUP.md](GITHUB_SETUP.md)** - GitHub Actions and environments
  - Secret setup for all environments
  - Environment creation and protection
  - Branch protection rules
  - Deploy key configuration
  - CI/CD testing locally

---

## 🏗️ File Structure

```
AIRMAN-Core/
├── .env.example              # Template for all environments
├── .env.dev                  # ✅ Dev (safe to commit)
├── .env.staging              # ❌ Use GitHub Secrets
├── .env.prod                 # ❌ Use GitHub + Vault
│
├── docker-compose.yml        # Default (dev)
├── docker-compose.dev.yml    # Dev with hot-reload
├── docker-compose.staging.yml # Staging with persistence
├── docker-compose.prod.yml   # Prod with optimizations
│
├── .github/workflows/
│   ├── dev-build-test.yml        # Triggered on develop push
│   ├── staging-build-deploy.yml  # Triggered on staging push
│   └── prod-build-deploy.yml     # Triggered on main push (manual approval)
│
├── scripts/
│   ├── rollback.sh              # Quick rollback to previous version
│   ├── rotate-secrets.sh        # Rotate environment secrets
│   ├── backup-database.sh       # Backup database per environment
│   └── check-secrets.sh         # Audit GitHub secrets
│
├── ENVIRONMENT_SETUP.md         # 📖 Read this first!
├── SECRETS_MANAGEMENT.md        # 🔐 Security procedures
├── ROLLBACK_STRATEGY.md         # 🔄 Recovery procedures
└── GITHUB_SETUP.md              # 🌐 GitHub Actions setup

backups/
├── dev/                     # Dev backups (optional)
├── staging/                 # Staging backups
└── prod/                    # Production backups
```

---

## ⚡ Quick Start

### 1️⃣ Local Development

```bash
# Clone and setup
git clone git@github.com:saiprasadreddy33/AIRMAN-Core.git
cd AIRMAN-Core

# Start dev environment (uses .env.dev)
docker-compose -f docker-compose.dev.yml up -d

# Access
# Frontend: http://localhost:3000
# API: http://localhost:3001
```

### 2️⃣ Deploy to Staging

```bash
# Follow GITHUB_SETUP.md to configure GitHub secrets first!

# Create feature branch
git checkout develop
git checkout -b feature/your-feature-name

# Commit changes
git add .
git commit -m "feat: add your feature"

# Create PR to develop (staging pull request)
git push origin feature/your-feature-name

# After PR approved:
git checkout develop && git pull
git merge feature/your-feature-name
git push origin develop

# This triggers staging-build-deploy.yml workflow
# Monitor: Settings → Actions → staging-build-deploy
```

### 3️⃣ Deploy to Production

```bash
# (After testing in staging)

# Merge to main from develop
git checkout main
git pull origin main
git merge develop
git tag v1.0.0  # Semantic versioning
git push origin main --tags

# This triggers prod-build-deploy.yml workflow
# Manual approval required in GitHub Actions
# Monitor: Settings → Actions → prod-build-deploy
```

---

## 🔐 Environment Secrets Quick Reference

| Environment | Storage | Frequency | Who | How |
|---|---|---|---|---|
| **Dev** | `.env.dev` (Git) | Never | All developers | Use locally, never rotate |
| **Staging** | GitHub Secrets | Every 90 days | DevOps team | `scripts/rotate-secrets.sh staging` |
| **Prod** | GitHub + Vault | Every 30 days | On-call engineer | `scripts/rotate-secrets.sh prod` |

---

## 🔄 Rollback Reference

| Issue | Scenario | Time | Command |
|---|---|---|---|
| Bad code | Deployment failed | 5 min | `scripts/rollback.sh prod` |
| Data corruption | Schema migration broke DB | 15 min | [ROLLBACK_STRATEGY.md](ROLLBACK_STRATEGY.md#option-2-rollback-database-only) |
| Feature bug | New feature causing crashes | 1 sec | Disable feature flag (via API) |
| Security breach | Compromised API key | 2 min | `scripts/rotate-secrets.sh prod` |
| Emergency | Complete outage | 5 min | `bash emergency-rollback.sh` |

---

## ✅ Pre-Deployment Checklist

### Before Merging to Staging
- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] `npm run build` completes without errors
- [ ] Staging secrets are set in GitHub
- [ ] QA has tested the feature

### Before Deploying to Production
- [ ] PR approved by 2+ senior developers
- [ ] All CI checks pass
- [ ] Feature tested and verified in staging
- [ ] Database migrations tested
- [ ] Release notes written
- [ ] Rollback plan documented
- [ ] On-call team notified
- [ ] Production backup confirmed

---

## 🚨 In Case of Emergency

### If something breaks in Production:

```bash
# 1. Emergency Rollback (all-in-one)
cd /path/to/AIRMAN-Core
./scripts/rollback.sh prod

# 2. Emergency Secrets Rotation (if compromised)
./scripts/rotate-secrets.sh prod

# 3. Check what's broken
docker-compose -f docker-compose.prod.yml logs -f api

# 4. Notify the team
# Slack: #incident-response
# PagerDuty: incidents@airman.pagerduty.com

# 5. Schedule post-mortem
# Calendar invite: 1 hour after incident resolved
```

---

## 📊 Environment Comparison

```
                     Dev          Staging          Production
Database URLs:    localhost      staging.int.      prod.aws.internal
API Endpoint:     localhost:3001 staging-api.     api.airman.com
Frontend:         localhost:3000 staging.airman   airman.com
Seeding:          ✅ Enabled     ❌ Disabled      ❌ Disabled
Logging:          DEBUG          INFO             WARN
Backups:          None           Manual           Automated
SSL/TLS:          None           Self-signed      Let's Encrypt
Data Retention:   None           30 days          1 year
Status Checks:    None           Every 30s        Every 60s
Auto-restart:     Unless-stopped Always           Always
```

---

## 🔗 Useful Commands

### Check secret status
```bash
scripts/check-secrets.sh
```

### Backup database
```bash
scripts/backup-database.sh staging
scripts/backup-database.sh prod
```

### Rotate secrets
```bash
scripts/rotate-secrets.sh staging
scripts/rotate-secrets.sh prod
```

### View logs
```bash
docker-compose -f docker-compose.dev.yml logs -f api
docker-compose -f docker-compose.staging.yml logs -f api
docker-compose -f docker-compose.prod.yml logs -f api
```

### Check service health
```bash
curl http://localhost:3001/health
curl http://localhost:3000/health
```

---

## 📞 Support & Escalation

### For Questions:
1. Check relevant documentation file
2. Review GitHub Actions logs
3. Contact team lead

### For Incidents:
1. See [Rollback Strategy](ROLLBACK_STRATEGY.md)
2. Activate emergency procedures
3. Page on-call engineer
4. Post incident in #incidents channel

---

## 🎯 Key Takeaways

1. **Three Environments**: Dev (local) → Staging (cloud test) → Production (live)
2. **Safe Dev Secrets**: `.env.dev` can be committed (safe defaults)
3. **Protected Prod Secrets**: Always use GitHub Secrets + Vault, never Git
4. **Automatic Deployments**: Push to `develop`/`staging`/`main` triggers CI/CD
5. **Easy Rollback**: Run `scripts/rollback.sh prod` to instantly recover
6. **Rotation Schedule**: Dev never, Staging every 90 days, Prod every 30 days

---

## 📖 Further Reading

For comprehensive details, see:
- [Full Environment Setup Guide](ENVIRONMENT_SETUP.md)
- [Complete Secrets Management Guide](SECRETS_MANAGEMENT.md)
- [Detailed Rollback Procedures](ROLLBACK_STRATEGY.md)
- [GitHub Actions Configuration](GITHUB_SETUP.md)

---

✨ **Last Updated**: Feb 23, 2026 | **Version**: 1.0.0 | **Status**: Production Ready
