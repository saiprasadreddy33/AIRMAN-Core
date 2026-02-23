# Rollback Strategy

## Overview

The rollback strategy ensures rapid recovery from failed deployments, security incidents, or data corruption. AIRMAN Core supports multiple rollback scenarios with automated and manual procedures.

---

## 🎯 Rollback Scenarios

### 1. Failed Deployment (Minutes to rollback)
**When**: New code introduces bugs that break production
**Impact**: High (application down or degraded)
**Detection**: Health checks fail, error rate spikes
**RTO**: < 5 minutes
**RPO**: 0 (no data loss)

### 2. Database Migration Issues (Minutes to hours)
**When**: Schema migration causes data inconsistency
**Impact**: High (data corruption)
**Detection**: Application crashes on DB query
**RTO**: < 30 minutes
**RPO**: < 1 hour

### 3. Security Incident (Seconds to minutes)
**When**: Unauthorized access or data breach detected
**Impact**: Critical
**Detection**: Unusual activity in logs
**RTO**: < 2 minutes
**RPO**: 0

### 4. Resource Exhaustion (Minutes)
**When**: Memory/CPU/Disk runs out
**Impact**: Medium (service slow/down)
**Detection**: Alerting system or manual notice
**RTO**: < 10 minutes
**RPO**: N/A (infrastructure issue)

---

## 🚀 Automated Rollback (GitHub Actions)

### Health Check & Auto Rollback
```yaml
# .github/workflows/prod-build-deploy.yml
deploy-production:
  steps:
    - name: Deploy to Production
      run: |
        DEPLOYMENT_ID=$(date +%s)
        docker-compose -f docker-compose.prod.yml pull
        docker-compose -f docker-compose.prod.yml up -d
        echo $DEPLOYMENT_ID > /tmp/current-deployment

    - name: Wait for Services
      run: sleep 30

    - name: Health Check
      id: health-check
      run: |
        STATUS=0
        for i in {1..10}; do
          if curl -f http://localhost:3001/health && curl -f http://localhost:3000/health; then
            echo "✅ Health check passed"
            exit 0
          fi
          echo "❌ Health check attempt $i failed, retrying in 10s..."
          sleep 10
        done
        exit 1

    - name: Rollback on Failure
      if: failure() && steps.health-check.outcome == 'failure'
      run: |
        echo "🔴 Health check failed - initiating rollback"
        PREVIOUS_TAG=$(git describe --tags --abbrev=0 HEAD~1)
        docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api:${PREVIOUS_TAG}
        docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend:${PREVIOUS_TAG}
        docker tag ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api:${PREVIOUS_TAG} airman-core-api:latest
        docker tag ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend:${PREVIOUS_TAG} airman-core-frontend:latest
        docker-compose -f docker-compose.prod.yml up -d
        sleep 30
        curl -f http://localhost:3001/health || (echo "❌ Rollback failed!" && exit 1)
        echo "✅ Rollback successful"

    - name: Notify Team
      if: failure()
      uses: slackapi/slack-github-action@v1
      with:
        webhook-url: ${{ secrets.SLACK_WEBHOOK }}
        payload: |
          {
            "text": "🔴 Production deployment FAILED and was automatically rolled back",
            "blocks": [
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": "*Production Deployment - AUTO ROLLBACK*\nCommit: ${{ github.sha }}\nAuthor: ${{ github.actor }}\nView: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
                }
              }
            ]
          }
```

---

## 🔄 Manual Rollback Procedures

### Option 1: Rollback to Previous Git Tag
**Time**: 2-5 minutes
**Data impact**: None
**Commands**:
```bash
#!/bin/bash
# rollback.sh - Manual rollback script

ENVIRONMENT=${1:-prod}  # prod, staging, dev
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"

echo "🔄 Initiating rollback to previous deployment..."

# 1. Get previous tag
CURRENT_TAG=$(git describe --tags --exact-match 2>/dev/null || echo "main")
PREVIOUS_TAG=$(git describe --tags --abbrev=0 ${CURRENT_TAG}^ 2>/dev/null)

if [ -z "$PREVIOUS_TAG" ]; then
  echo "❌ No previous tag found"
  exit 1
fi

echo "Current: $CURRENT_TAG"
echo "Rollback to: $PREVIOUS_TAG"
read -p "Continue? (y/n) " -n 1 -r; echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 1
fi

# 2. Pull previous images
docker pull ${{ env.REGISTRY }}/saiprasadreddy33/AIRMAN-Core/api:${PREVIOUS_TAG}
docker pull ${{ env.REGISTRY }}/saiprasadreddy33/AIRMAN-Core/frontend:${PREVIOUS_TAG}

# 3. Tag as latest
docker tag ${{ env.REGISTRY }}/saiprasadreddy33/AIRMAN-Core/api:${PREVIOUS_TAG} airman-core-api:latest
docker tag ${{ env.REGISTRY }}/saiprasadreddy33/AIRMAN-Core/frontend:${PREVIOUS_TAG} airman-core-frontend:latest

# 4. Restart services
docker-compose -f ${COMPOSE_FILE} down
docker-compose -f ${COMPOSE_FILE} up -d

# 5. Health check
echo "Waiting for services to start..."
sleep 30

if curl -f http://localhost:3001/health > /dev/null 2>&1; then
  echo "✅ Rollback successful"
  git checkout ${PREVIOUS_TAG}
else
  echo "❌ Health check failed after rollback"
  exit 1
fi
```

**Usage**:
```bash
chmod +x rollback.sh
./rollback.sh prod          # Rollback production
./rollback.sh staging       # Rollback staging
```

### Option 2: Rollback Database Only
**Time**: 5-15 minutes
**Data impact**: Reverts to previous database state
**Scenario**: Code is fine, but data is corrupted
**Commands**:
```bash
#!/bin/bash
# rollback-database.sh

ENVIRONMENT=${1:-prod}
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
BACKUP_DIR="./backups/${ENVIRONMENT}"

# 1. List available backups
echo "Available backups:"
ls -lht ${BACKUP_DIR}/*.sql | head -10

# 2. Select backup
read -p "Enter backup filename (without path): " BACKUP_FILE
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

if [ ! -f "$BACKUP_PATH" ]; then
  echo "❌ Backup file not found: $BACKUP_PATH"
  exit 1
fi

echo "Rollback will restore from: $BACKUP_PATH"
read -p "Type 'CONFIRM' to restore: " confirm
if [ "$confirm" != "CONFIRM" ]; then
  exit 1
fi

# 3. Backup current database
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker-compose -f ${COMPOSE_FILE} exec -T postgres pg_dump \
  -U airman_${ENVIRONMENT} airman_${ENVIRONMENT} \
  > ${BACKUP_DIR}/pre-rollback_${TIMESTAMP}.sql

# 4. Restore from backup
docker-compose -f ${COMPOSE_FILE} exec -T postgres psql \
  -U airman_${ENVIRONMENT} airman_${ENVIRONMENT} \
  < ${BACKUP_PATH}

echo "✅ Database restored from: $BACKUP_FILE"
echo "⚠️  Pre-rollback backup saved: pre-rollback_${TIMESTAMP}.sql"
```

### Option 3: Rollback Feature Flag (instant, no redeployment)
**Time**: < 1 second
**Data impact**: None
**Best for**: New feature causing issues
**CLI**:
```bash
# Disable problematic feature via API
curl -X POST http://localhost:3001/admin/features/new-booking-flow/disable \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Or via database
docker-compose -f docker-compose.prod.yml exec postgres psql \
  -U airman_prod airman_prod \
  -c "UPDATE feature_flags SET enabled = false WHERE key = 'new-booking-flow';"

# No restart needed - API picks up changes on next request
```

### Option 4: Rollback Secrets (for security incident)
**Time**: 2-5 minutes
**Data impact**: None
**Scenario**: Compromised API key or password
**Commands**:
```bash
#!/bin/bash
# rollback-secrets.sh

ENVIRONMENT=${1:-prod}
VAULT_PATH="secret/${ENVIRONMENT}"

echo "🔐 Secrets Rollback Initiated"

# 1. Revoke current secret
echo "Revoking current secret..."
case $ENVIRONMENT in
  prod)
    gh secret delete PROD_JWT_KEY PROD_DB_PASSWORD PROD_REDIS_PASSWORD
    ;;
  staging)
    gh secret delete STAGING_JWT_KEY STAGING_DB_PASSWORD STAGING_REDIS_PASSWORD
    ;;
esac

# 2. Restore from vault backup
echo "Restoring secrets from vault backup..."
vault kv get ${VAULT_PATH}/backup/jwt_key | extract-value
vault kv get ${VAULT_PATH}/backup/db_password | extract-value
vault kv get ${VAULT_PATH}/backup/redis_password | extract-value

# 3. Re-apply secrets
echo "Applying secrets to GitHub..."
gh secret set ${ENVIRONMENT^^}_JWT_KEY --body "$(vault kv get -field=value ${VAULT_PATH}/backup/jwt_key)"
gh secret set ${ENVIRONMENT^^}_DB_PASSWORD --body "$(vault kv get -field=value ${VAULT_PATH}/backup/db_password)"
gh secret set ${ENVIRONMENT^^}_REDIS_PASSWORD --body "$(vault kv get -field=value ${VAULT_PATH}/backup/redis_password)"

# 4. Redeploy
echo "Redeploying services..."
git push origin ${ENVIRONMENT}

echo "✅ Secrets rolled back successfully"
```

---

## 📊 Rollback Decision Tree

```
Issue Detected
├─ Code Problem?
│  ├─ Yes → Rollback deployment (Option 1)
│  │
│  └─ Caused by new feature?
│     ├─ Yes → Disable feature flag (Option 3)
│     └─ No → See below
│
├─ Database Problem?
│  ├─ Schema corruption → Rollback database (Option 2)
│  ├─ Data corruption → Rollback database (Option 2)
│  └─ Connection issues → Restart containers
│
├─ Security Issue?
│  ├─ Compromised secret → Rollback secrets (Option 4)
│  ├─ Unauthorized access → Revoke tokens + Rollback deployment
│  └─ Malicious code → Full rollback (Option 1) + Audit logs
│
└─ Infrastructure Problem?
   ├─ Disk full → Clean containers + Restart
   ├─ Memory issues → Scale down + Restart
   └─ Network issues → Restart containers + Check DNS
```

---

## ⏱️ RTO/RPO by Scenario

| Scenario | RTO | RPO | Rollback Method | Risk Level |
|----------|-----|-----|-----------------|-----------|
| Bad deployment | 5 min | 0 | Git tag rollback | Low |
| Schema corruption | 15 min | 0 | Backup restore | Medium |
| Data corruption | 30 min | 0 | Backup restore | Medium |
| Feature bug | 1 sec | 0 | Feature flag | Low |
| Disk full | 10 min | 0 | Cleanup + restart | Low |
| Memory leak | 5 min | 0 | Restart container | Low |
| Compromised API key | 2 min | 0 | Secret rotation | High |
| Malicious code merge | 5 min | 0 | Git tag rollback | Critical |
| Ransomware attack | 1 hour | 24 hrs | Vault restore | Critical |

---

## 🧪 Rollback Testing

### Monthly Rollback Drill
```bash
#!/bin/bash
# test-rollback.sh - Simulate rollback in staging

echo "🧪 Starting rollback drill in STAGING..."

# 1. Deploy current version
git checkout main
docker-compose -f docker-compose.staging.yml build
docker-compose -f docker-compose.staging.yml up -d

# 2. Verify deployment
curl -f http://localhost:3000/health || exit 1

# 3. Simulate rollback
echo "Initiating rollback..."
PREVIOUS=$(git describe --tags --abbrev=0 HEAD~1)
git checkout ${PREVIOUS}

# 4. Execute rollback
./rollback.sh staging

# 5. Verify rollback
curl -f http://localhost:3000/health || (echo "Rollback failed!" && exit 1)

# 6. Report
echo "✅ Rollback drill completed successfully"
echo "📅 Schedule: First Monday of each month at 2 AM UTC"
```

### Add to Cron
```bash
# Monthly rollback test (staging environment)
0 2 1 * * cd /opt/AIRMAN-Core && ./test-rollback.sh >> /var/log/rollback-test.log 2>&1
```

---

## 📋 Rollback Checklist

### Before Rollback
- [ ] Verify the rollback procedure
- [ ] Notify team on Slack
- [ ] Take snapshot of current state (logs, metrics)
- [ ] Identify rollback target (tag, backup, feature flag)
- [ ] Ensure backup/previous version exists and is accessible

### During Rollback
- [ ] Execute rollback procedure
- [ ] Monitor health checks
- [ ] Monitor error rates
- [ ] Monitor logs for warnings/errors
- [ ] Test critical paths manually

### After Rollback
- [ ] Verify all services healthy
- [ ] Verify user-facing functionality works
- [ ] Check database connectivity
- [ ] Review error rates (should return to baseline)
- [ ] Document rollback in incident ticket
- [ ] Notify team - rollback successful
- [ ] Schedule post-mortem (if incident)

---

## 🚨 Critical Incident Rollback

For **Critical Security** or **Complete Outage**:

```bash
#!/bin/bash
# emergency-rollback.sh

cat << 'EOF'
╔════════════════════════════════════════════╗
║  🔴 EMERGENCY ROLLBACK INITIATED 🔴        ║
║  This will immediately rollback production ║
╚════════════════════════════════════════════╝
EOF

echo "Confirming details..."
echo "Environment: PRODUCTION"
echo "Action: Full rollback to previous stable version"
echo "Impact: 5-10 minutes of active monitoring required"
echo ""

read -p "Type 'EMERGENCY' to confirm: " confirm
if [ "$confirm" != "EMERGENCY" ]; then
  echo "Aborted"
  exit 1
fi

# 1. Mark incident
INCIDENT_ID="INCIDENT-$(date +%Y%m%d-%H%M%S)"
echo $INCIDENT_ID > /tmp/incident-id.txt

# 2. Stop all traffic (if possible)
echo "⏸️  Stopping traffic..."
# Update load balancer / DNS (if applicable)

# 3. Full rollback
echo "🔄 Rolling back..."
git checkout $(git describe --tags --abbrev=0 HEAD~1)
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# 4. Verify
sleep 30
if ! curl -f http://localhost:3001/health; then
  echo "❌ ROLLBACK FAILED - Manual intervention required!"
  exit 1
fi

# 5. Restore traffic
echo "✅ Restoring traffic..."

# 6. Notify
echo "🚨 INCIDENT: $INCIDENT_ID"
echo "Status: ROLLED BACK"
echo "Next: Post-incident review in 1 hour"
```

---

## 📞 Escalation & Contact

**Rollback authority by severity**:
- Low (feature bug): Any engineer
- Medium (data corruption): Engineering lead
- High (security): CTO + Security lead
- Critical (complete outage): CTO + DevOps + Incident commander

**Emergency contacts**:
- On-call engineer: \`on-call.airman.com\`
- Slack channel: \`#incident-response\`
- PagerDuty: \`incidents@airman.pagerduty.com\`

---

## 🔗 Related Documentation

- [Secrets Management](./SECRETS_MANAGEMENT.md) - Handling compromised secrets
- [Environment Setup](./ENVIRONMENT_SETUP.md) - Understanding deployments
- [GitHub Actions CI/CD](../.github/workflows/) - Automated deployment workflows
