#!/bin/sh
set -e

echo "==> Running Prisma migrations..."
npx prisma migrate deploy

if [ "$RUN_DB_SEED" = "true" ]; then
	echo "==> Seeding initial data..."
	npm run prisma:seed
fi

echo "==> Starting API server..."
exec node dist/src/main.js
