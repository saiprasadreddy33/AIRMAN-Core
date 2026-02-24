#!/bin/sh
set -e

echo "==> Running Prisma generate..."
npx prisma generate

echo "==> Running Prisma migrations..."
npx prisma migrate deploy

if [ "$RUN_DB_SEED" = "true" ]; then
	echo "==> Seeding initial data..."
	if ! node -r ts-node/register prisma/seed.ts; then
		echo "==> TS seed failed, falling back to prisma/seed.js"
		node prisma/seed.js
	fi
fi

echo "==> Starting API server..."
exec node dist/src/main.js
