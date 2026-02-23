# GitHub Environment Setup Guide

## Prerequisites

- GitHub repository: https://github.com/saiprasadreddy33/AIRMAN-Core
- Admin access to repository
- Permission to create environments and secrets

---

## 🔧 Step 1: Create GitHub Secrets

### For Development (`.env.dev` - Already in Git)
No GitHub secrets needed - using .env.dev in repository

### For Staging Environment

1. Go to: Settings → Secrets and variables → Actions
2. Create the following secrets:

| Secret Name | Description | Example |
|---|---|---|
| `STAGING_DB_PASSWORD` | PostgreSQL password | `$(openssl rand -base64 32)` |
| `STAGING_REDIS_PASSWORD` | Redis password | `$(openssl rand -base64 32)` |
| `STAGING_JWT_KEY` | JWT signing key | `$(openssl rand -base64 64)` |
| `STAGING_SERVER` | Staging server IP/domain | `staging.example.com` |
| `STAGING_DEPLOY_KEY` | SSH deploy private key | `(cat ~/.ssh/staging_deploy_key)` |
| `SLACK_WEBHOOK` | (Optional) Slack notifications | From Slack app settings |

**Commands to generate secrets:**
```bash
# Copy each output into GitHub

# DB Password
openssl rand -base64 32

# Redis Password
openssl rand -base64 32

# JWT Key
openssl rand -base64 64

# Get SSH public key for server
cat ~/.ssh/staging_deploy.pub
```

### For Production Environment

1. Go to: Settings → Secrets and variables → Actions
2. Create the following secrets:

| Secret Name | Description |
|---|---|
| `PROD_DB_PASSWORD` | PostgreSQL password (encrypted) |
| `PROD_REDIS_PASSWORD` | Redis password (encrypted) |
| `PROD_JWT_KEY` | JWT signing key (rotate every 30 days) |
| `PROD_SERVER` | Production server IP/domain |
| `PROD_DEPLOY_KEY` | SSH deploy private key |
| `SLACK_WEBHOOK` | Slack notifications |

⚠️ **Security**: Store actual values in vault/HSM, copy references from there

---

## 🌍 Step 2: Create GitHub Environments

### Staging Environment

1. Settings → Environments → New environment
2. Name: **staging**
3. Configure reviewers: (optional)
4. Add secrets (same as above)

### Production Environment

1. Settings → Environments → New environment
2. Name: **production**
3. **Enable protection rules**:
   - Required reviewers: ✅ (add 2+ team leads)
   - Prevent environment deadlocks: ✅ (unchecked)
4. Add secrets

---

## 🔐 Step 3: Branch Protection Rules

1. Settings → Branches → Add branch protection rule

### For `develop` branch
- Branch name pattern: `develop`
- ✅ Require pull request reviews before merging (1 reviewer)
- ✅ Require status checks to pass (select: lint, build, test)
- ✅ Require branches to be up to date

### For `staging` branch
- Branch name pattern: `staging`
- ✅ Require pull request reviews before merging (1 reviewer)
- ✅ Require status checks to pass
- ✅ Require branches to be up to date

### For `main` branch
- Branch name pattern: `main`
- ✅ Require pull request reviews before merging (2 reviewers)
- ✅ Require review from code owners: ✅
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Include administrators: ✅
- ✅ Dismiss stale pull request approvals: ✅
- ✅ Require conversation resolution before merging: ✅

---

## 🚀 Step 4: Configure CI/CD Workflows

Workflows are already configured in `.github/workflows/`:
- `dev-build-test.yml` - Runs on `develop` branch pushes
- `staging-build-deploy.yml` - Runs on `staging` branch pushes
- `prod-build-deploy.yml` - Runs on `main` branch pushes (requires approval)

**Verify workflows are enabled:**

Settings → Actions → General
- ✅ Actions permissions: "Allow all actions and reusable workflows"
- ✅ Fork pull request workflows: "Run workflows from fork pull requests"

---

## 📋 Step 5: Set Up Deployment Keys

### Staging Server Deploy Key

**Generate:**
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/staging_deploy_key -N ""
```

**On staging server:**
```bash
# Add public key to authorized_keys
cat ~/.ssh/staging_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

**In GitHub:**
1. Settings → Deploy keys → Add deploy key
2. Title: `staging-deploy`
3. Key: `(cat ~/.ssh/staging_deploy.pub)`
4. ✅ Allow write access

---

## 🔑 Step 6: Set Up Container Registry Access

GitHub Container Registry (ghcr.io) uses your token automatically.

**For private registries (optional):**
1. Settings → Secrets
2. Create: `DOCKER_REGISTRY_USERNAME` and `DOCKER_REGISTRY_PASSWORD`

---

## ✅ Deployment Checklist

Before deploying to each environment:

### Develop → Staging
- [ ] PR approved by 1+ reviewer
- [ ] All CI checks pass
- [ ] No migration warnings
- [ ] QA team notified
- [ ] Staging secrets updated

### Staging → Production
- [ ] PR approved by 2+ senior developers
- [ ] All CI checks pass
- [ ] Smoke tests passed in staging
- [ ] Security review complete
- [ ] Release notes written
- [ ] On-call team notified
- [ ] Backup verified
- [ ] Rollback plan reviewed

---

## 🧪 Testing CI/CD Locally

### Test Docker builds locally
```bash
# Dev
docker-compose -f docker-compose.dev.yml build

# Staging
docker-compose -f docker-compose.staging.yml build

# Prod
docker-compose -f docker-compose.prod.yml build
```

### Test workflows locally (optional)
Using `act` (GitHub Actions locally):
```bash
# Install act
brew install act

# Run dev workflow
act push --job build-and-test -P ubuntu-latest=-self-hosted

# Run staging workflow  
act push --job deploy-staging -P ubuntu-latest=-self-hosted
```

---

## 📞 Troubleshooting

### Workflow not triggering
- [ ] Check branch name matches workflow condition
- [ ] Verify `.github/workflows/` files are committed
- [ ] Check Actions tab for disabled status

### Deployment failing
- [ ] Check logs in Actions tab
- [ ] Verify secrets are set and not expired
- [ ] Check deploy key permissions on server
- [ ] Verify server can pull Docker images

### Secret not found in workflow
- [ ] Secret must be set in same environment or repository
- [ ] Secret name must match exactly (case-sensitive)
- [ ] Try: `${{ secrets.STAGING_DB_PASSWORD }}`

---

## 🔗 References

- GitHub Actions docs: https://docs.github.com/en/actions
- GitHub Secrets: https://docs.github.com/en/actions/security-guides/encrypted-secrets
- Container Registry: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- Branch protection: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
