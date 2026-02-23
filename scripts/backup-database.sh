#!/bin/bash
# scripts/backup-database.sh - Backup database for all environments

set -e

ENVIRONMENT=${1:-prod}
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
BACKUP_DIR="./backups/${ENVIRONMENT}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "❌ Docker Compose file not found: $COMPOSE_FILE"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "════════════════════════════════════════════════════════════"
echo "  💾 Database Backup"
echo "════════════════════════════════════════════════════════════"
echo "Environment: $ENVIRONMENT"
echo "Backup directory: $BACKUP_DIR"
echo ""

# Determine DB details from environment
case $ENVIRONMENT in
  dev)
    DB_USER="airman"
    DB_NAME="airman"
    ;;
  staging)
    DB_USER="airman_staging"
    DB_NAME="airman_staging"
    ;;
  prod)
    DB_USER="airman_prod"
    DB_NAME="airman_prod"
    ;;
  *)
    echo "❌ Unknown environment: $ENVIRONMENT"
    exit 1
    ;;
esac

BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"

echo "⏳ Creating backup..."
docker-compose -f ${COMPOSE_FILE} exec -T postgres pg_dump \
  -U ${DB_USER} ${DB_NAME} > ${BACKUP_FILE}

echo "📦 Compressing backup..."
gzip ${BACKUP_FILE}

# Calculate size
SIZE=$(du -h "${BACKUP_FILE_GZ}" | cut -f1)

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Backup completed!"
echo "════════════════════════════════════════════════════════════"
echo "File: ${BACKUP_FILE_GZ}"
echo "Size: $SIZE"
echo ""
echo "Restore with:"
echo "  gunzip < ${BACKUP_FILE_GZ} | docker-compose -f ${COMPOSE_FILE} exec -T postgres psql -U ${DB_USER} ${DB_NAME}"
