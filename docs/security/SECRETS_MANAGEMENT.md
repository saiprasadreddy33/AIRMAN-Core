# Secrets Management Strategy

## Overview

AIRMAN Core implements a multi-layered secrets management approach to ensure production credentials are never committed to Git while maintaining easy access for deployments and local development.

---

## 🔐 Secrets Categories

### 1. **Development Secrets** (Safe to commit)
- Local development credentials (default DBpasswords, dev JWT keys)
- Mock API keys
- Certificate: `.env.dev` ✅ Committed to Git
- **Never contains**: production credentials

### 2. **Staging Secrets** (GitHub Secrets only)
- Staging database passwords
- Staging Redis passwords
- Staging JWT key
- Staging SSL certificates
- **Location**: GitHub Secrets (encrypted)
- **Used by**: CI/CD pipeline for staging deployments

### 3. **Production Secrets** (Restricted)
- Production database passwords (encrypted at rest)
- Production Redis passwords (encrypted)
- Production JWT keys (rotated regularly)
- Production SSL/TLS certificates
- Sendgrid/Email API keys
- Payment processor credentials
- **Location**: GitHub Secrets + Hardware Security Module (HSM)
- **Access**: Limited to GitHub Actions + on-call team

---

## 📋 Secrets Setup Checklist

### Local Development
No setup needed - `.env.dev` is already in the repo with safe defaults.

### Staging Environment
```bash
# 1. Generate secure passwords
staging_db_pass=$(openssl rand -base64 32)
staging_redis_pass=$(openssl rand -base64 32)
staging_jwt=$(openssl rand -base64 64)

# 2. Add to GitHub Secrets (via CLI or web UI)
gh secret set STAGING_DB_PASSWORD --body "$staging_db_pass"
gh secret set STAGING_REDIS_PASSWORD --body "$staging_redis_pass"
gh secret set STAGING_JWT_KEY --body "$staging_jwt"
gh secret set STAGING_SERVER --body "staging.example.com"
gh secret set STAGING_DEPLOY_KEY --body "$(cat ~/.ssh/staging-deploy-key)"

# 3. Verify secrets are set
gh secret list
```

### Production Environment
```bash
# 1. Generate production-grade secrets (use 256-bit keys)
prod_db_pass=$(openssl rand -base64 48)
prod_redis_pass=$(openssl rand -base64 48)
prod_jwt=$(openssl rand -base64 96)

# 2. Store in secure vault FIRST (not GitHub)
# Option A: 1Password / LastPass
vault write secret/prod/db_password value="$prod_db_pass"

# Option B: AWS Secrets Manager (Recommended for AWS deployments)
aws secretsmanager create-secret \
  --name prod/airman/db_password \
  --secret-string "$prod_db_pass" \
  --region us-east-1

# Option C: HashiCorp Vault
vault kv put secret/prod/airman/db_password value="$prod_db_pass"

# 3. Add to GitHub Secrets via UI (requires approval)
# Settings → Secrets and variables → Actions → New repository secret
# Name: PROD_DB_PASSWORD
# Value: [from vault]

# 4. Verify (list only, don't expose values)
gh secret list | grep PROD
```

---

## 🛡️ Secrets Rotation Policy

### Development Secrets
- **Rotation**: Never (public/safe passwords)
- **Location**: `.env.dev` (committed)

### Staging Secrets
- **Rotation**: Every 90 days
- **Process**:
  ```bash
  # 1. Generate new secret
  new_pass=$(openssl rand -base64 32)

  # 2. Update database
  docker-compose -f docker-compose.staging.yml exec postgres \
    psql -U airman_staging -d airman_staging \
    -c "ALTER ROLE airman_staging WITH PASSWORD '$new_pass';"

  # 3. Update GitHub Secret
  gh secret set STAGING_DB_PASSWORD --body "$new_pass"

  # 4. Update `.env.staging` locally
  sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$new_pass/" .env.staging

  # 5. Redeploy to staging
  git push origin staging
  ```

### Production Secrets
- **Rotation**: Every 30 days (or immediately if compromised)
- **Process**:
  ```bash
  # 1. Generate new secrets
  new_pass=$(openssl rand -base64 48)
  new_jwt=$(openssl rand -base64 96)

  # 2. Store old secrets in archive (encrypted)
  echo "Date: $(date), Old Password: $old_pass" | gpg --symmetric > secrets-backup-$(date +%Y%m%d).gpg

  # 3. Update in vault/secrets manager
  aws secretsmanager update-secret \
    --secret-id prod/airman/db_password \
    --secret-string "$new_pass"

  # 4. Rotate in database (zero-downtime)
  # Create new user first, then switch
  docker-compose -f docker-compose.prod.yml exec postgres psql \
    -U airman_prod -d airman_prod \
    -c "CREATE ROLE airman_prod_new WITH PASSWORD '$new_pass';" && \
  docker-compose -f docker-compose.prod.yml exec postgres psql \
    -U postgres -d airman_prod \
    -c "GRANT ALL PRIVILEGES ON DATABASE airman_prod TO airman_prod_new;" && \
  # ... wait for connections to drain, then drop old role

  # 5. Update GitHub Secret
  gh secret set PROD_DB_PASSWORD --body "$new_pass"
  gh secret set PROD_JWT_KEY --body "$new_jwt"

  # 6. Trigger redeployment
  git push origin main
  ```

---

## 🔑 Access Control Matrix

| Secret | Dev | Staging | Prod |
|--------|-----|---------|------|
| Location | `.env.dev` (Git) | GitHub Secrets | GitHub Secrets + Vault |
| Who can view | Everyone | DevOps team | On-call engineer only |
| Rotation | Never | 90 days | 30 days |
| Audit logging | Git history | GitHub audit log | Vault audit log |
| Encryption at rest | No (plaintext) | GitHub encrypted | AES-256 |
| Backup | Git backup | GitHub backup | Vault backup + HSM |

---

## 🔄 Secrets in CI/CD Pipelines

### Development Pipeline (Dev)
Uses `.env.dev` (committed, non-sensitive):
```yaml
steps:
  - name: Build with Dev Secrets
    env:
      DATABASE_URL: postgresql://airman:airman-dev-password@postgres:5432/airman
    run: docker-compose up --build
```

### Staging Pipeline (Staging)
Uses GitHub Secrets (encrypted):
```yaml
steps:
  - name: Build with Staging Secrets
    env:
      POSTGRES_PASSWORD: ${{ secrets.STAGING_DB_PASSWORD }}
      REDIS_PASSWORD: ${{ secrets.STAGING_REDIS_PASSWORD }}
      JWT_KEY: ${{ secrets.STAGING_JWT_KEY }}
    run: |
      docker-compose -f docker-compose.staging.yml build
      docker-compose -f docker-compose.staging.yml up -d
```

### Production Pipeline (Production)
Uses GitHub Secrets + environment protection:
```yaml
deploy-production:
  environment: production  # Requires approval
  steps:
    - name: Deploy with Production Secrets
      env:
        POSTGRES_PASSWORD: ${{ secrets.PROD_DB_PASSWORD }}
        REDIS_PASSWORD: ${{ secrets.PROD_REDIS_PASSWORD }}
        JWT_KEY: ${{ secrets.PROD_JWT_KEY }}
      run: |
        ssh -i ~/.ssh/prod-key root@prod-server "
          export POSTGRES_PASSWORD=${{ secrets.PROD_DB_PASSWORD }}
          docker-compose -f docker-compose.prod.yml pull
          docker-compose -f docker-compose.prod.yml up -d
        "
```

---

## 🚨 Secrets Compromise Response

### If Development Secret Compromised
1. ✅ Generate new secret
2. ✅ Update `.env.dev`
3. ✅ Commit and push
4. ✅ No immediate urgency (dev-only)

### If Staging Secret Compromised
1. ⚠️ Immediately rotate secret (see above)
2. ⚠️ Review recent deployments for unauthorized changes
3. ⚠️ Check staging server logs for suspicious activity
4. ⚠️ Notify staging team
5. ⚠️ Run security scan

### If Production Secret Compromised
1. 🔴 **CRITICAL INCIDENT**
2. 🔴 Immediately page on-call security engineer
3. 🔴 Rotate ALL production secrets immediately (don't wait for approval)
4. 🔴 Revoke JWT tokens (invalidate all sessions)
5. 🔴 Review audit logs for unauthorized access
6. 🔴 Kill all AWS sessions / cloud API keys
7. 🔴 Change database user credentials
8. 🔴 Force re-authentication for all users
9. 🔴 Post-incident review within 24 hours

### Emergency Secret Rotation Script
```bash
#!/bin/bash
# emergency-secret-rotation.sh
# Run ONLY during security incident

set -e

echo "🔴 EMERGENCY SECRET ROTATION INITIATED"
read -p "Type 'CONFIRM' to proceed: " confirm
if [ "$confirm" != "CONFIRM" ]; then
  echo "Aborted"
  exit 1
fi

# 1. Rotate database password
NEW_DB_PASS=$(openssl rand -base64 48)
echo "Rotating database password..."
docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres -c "ALTER ROLE airman_prod WITH PASSWORD '$NEW_DB_PASS';"

# 2. Rotate Redis password
NEW_REDIS_PASS=$(openssl rand -base64 48)
echo "Rotating Redis password..."
docker-compose -f docker-compose.prod.yml exec -T redis \
  redis-cli CONFIG SET requirepass "$NEW_REDIS_PASS"

# 3. Rotate JWT key
NEW_JWT=$(openssl rand -base64 96)
echo "Invalidating all JWT tokens..."
docker-compose -f docker-compose.prod.yml exec -T api \
  curl -X POST http://localhost:3001/auth/invalidate-all-sessions

# 4. Update GitHub Secrets (requires gh CLI)
echo "Updating GitHub Secrets..."
gh secret set PROD_DB_PASSWORD --body "$NEW_DB_PASS"
gh secret set PROD_REDIS_PASSWORD --body "$NEW_REDIS_PASS"
gh secret set PROD_JWT_KEY --body "$NEW_JWT"

# 5. Trigger redeployment
echo "Redeploying services..."
git pull origin main
git push origin main

echo "✅ Emergency rotation complete"
echo "⚠️  Review: https://github.com/saiprasadreddy33/AIRMAN-Core/security/audit-log"
```

---

## 📊 Secrets Audit Trail

### View GitHub Actions Secret Access
```bash
# List when secrets were last used
gh secret list

# Check audit log
gh repo view --json securityAndAnalysis
```

### View Vault/AWS Secrets Changes
```bash
# AWS Secrets Manager audit
aws secretsmanager list-secret-version-ids \
  --secret-id prod/airman/db_password

# HashiCorp Vault audit
vault audit enable file file_path=/var/log/vault-audit.log
vault audit list
```

### Database Access Audit
```bash
# PostgreSQL logs
docker-compose -f docker-compose.prod.yml exec postgres \
  tail -f /var/log/postgresql/postgresql.log | grep "authentication"

# Redis logs
docker-compose -f docker-compose.prod.yml exec redis \
  redis-cli INFO stats
```

---

## ✅ Best Practices

### DO ✅
- [ ] Rotate secrets regularly (calendar reminder)
- [ ] Use random generators (`openssl rand`) for secrets
- [ ] Store long-term secrets in vault, not GitHub
- [ ] Encrypt secrets in transit (HTTPS, SSH)
- [ ] Enable GitHub audit logging
- [ ] Review secret access logs weekly
- [ ] Never log secrets (even in debug mode)
- [ ] Use short-lived tokens where possible
- [ ] Document who has access to each secret
- [ ] Test secret rotation in staging first

### DON'T ❌
- [ ] Commit secrets to Git (ever!)
- [ ] Use weak passwords (< 32 characters)
- [ ] Share secrets via email, Slack, or chat
- [ ] Use the same secret across environments
- [ ] Hardcode secrets in code
- [ ] Log API responses that contain secrets
- [ ] Use default/placeholder secrets in production
- [ ] Disable secret scanning on GitHub
- [ ] Reuse old secrets for new services
- [ ] Skip rotation "because nothing changed"

---

## 🔗 Related Documentation

- [Environment Setup](./ENVIRONMENT_SETUP.md) - How to use secrets
- [Rollback Strategy](./ROLLBACK_STRATEGY.md) - Recovering from compromised secrets
- [Security Policy](./SECURITY.md) - Overall security guidelines
