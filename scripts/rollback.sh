#!/bin/bash
# scripts/rollback.sh - Automated rollback to previous deployment tag

set -e

ENVIRONMENT=${1:-prod}
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
REGISTRY="ghcr.io/saiprasadreddy33/AIRMAN-Core"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "❌ Docker Compose file not found: $COMPOSE_FILE"
  exit 1
fi

echo "════════════════════════════════════════════════════════════"
echo "  🔄 AIRMAN Core Rollback Script"
echo "════════════════════════════════════════════════════════════"
echo "Environment: $ENVIRONMENT"
echo "Compose file: $COMPOSE_FILE"
echo ""

# Get tags
CURRENT=$(git describe --tags --exact-match 2>/dev/null || git rev-parse --short HEAD)
PREVIOUS=$(git describe --tags --abbrev=0 ${CURRENT}^ 2>/dev/null || git rev-parse --short HEAD~1)

echo "Current version: $CURRENT"
echo "Rollback to: $PREVIOUS"
echo ""

# Confirmation
read -p "📋 Confirm rollback? (type 'yes' to continue): " confirm
if [ "$confirm" != "yes" ]; then
  echo "❌ Rollback cancelled"
  exit 1
fi

# Pull previous images
echo ""
echo "📥 Pulling previous Docker images..."
docker pull ${REGISTRY}/api:${PREVIOUS}
docker pull ${REGISTRY}/frontend:${PREVIOUS}

# Tag as latest
echo "🏷️  Tagging images..."
docker tag ${REGISTRY}/api:${PREVIOUS} airman-core-api:latest
docker tag ${REGISTRY}/frontend:${PREVIOUS} airman-core-frontend:latest

# Restart services
echo "🔄 Restarting services..."
docker-compose -f ${COMPOSE_FILE} down
sleep 5
docker-compose -f ${COMPOSE_FILE} up -d

# Wait for services
echo "⏳ Waiting for services to start..."
for i in {1..30}; do
  if curl -sf http://localhost:3001/health > /dev/null; then
    echo "✅ API health check passed"
    break
  fi
  echo "  Attempt $i/30..."
  sleep 2
done

# Final verification
if ! curl -sf http://localhost:3001/health > /dev/null; then
  echo "❌ Health check failed - rollback may have failed"
  exit 1
fi

# Update git reference
git checkout ${PREVIOUS}

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Rollback completed successfully!"
echo "════════════════════════════════════════════════════════════"
echo "Rolled back from: $CURRENT"
echo "Rolled back to: $PREVIOUS"
echo ""
echo "Next steps:"
echo "1. Verify application is working: http://localhost:3000"
echo "2. Check logs: docker-compose logs -f api"
echo "3. Document incident in GitHub Issues"
echo "4. Schedule post-mortem"
