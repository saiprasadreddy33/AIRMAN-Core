# CI/CD Troubleshooting Guide

## Common GitHub Actions Failures

### 1. ❌ "Prisma migration failed" in CI

**Symptoms:**
```
Error: P3014 Migrate found migrations that have not yet been applied to the database
```

**Causes:**
- Database not initialized properly
- Migration files are out of sync
- SQLite database corruption in CI

**Solution:**

Update `.github/workflows/ci.yml` to reset database before migrations:

```yaml
- name: ✅ Reset and migrate database
  working-directory: ./backend
  env:
    DATABASE_URL: postgresql://airman:airman@localhost:5432/airman?schema=public
  run: |
    # Drop all tables to get clean state
    npx prisma migrate reset --force --skip-generate
```

### 2. ❌ "Coverage below 40%" in CI

**Symptoms:**
```
Error: Coverage for lines (32%) is below threshold (40%)
```

**Causes:**
- Not enough test files or coverage
- Test files aren't being found/run
- New code without tests

**Solution:**

Check what's being tested:
```bash
# Locally, run with coverage report
npm run test:cov

# Open coverage report
open coverage/index.html  #macOS/Linux
start coverage/index.html #Windows
```

Add missing tests or exclude from coverage in `jest.config.js`:

```javascript
collectCoverageFrom: [
  '**/*.(t|j)s',
  '!**/*.spec.(t|j)s',
  '!**/*.module.ts',        // Controllers/modules don't need tests
  '!main.ts',
  '!**/dto/**',             // DTOs don't need full coverage
  '!**/entities/**',        // Entities mostly don't
],
```

### 3. ❌ "Linting failed" in CI

**Symptoms:**
```
Error: ESLint found X max warnings exceeded
```

**Solution:**

Run lint locally and fix:
```bash
# Backend
cd backend
npm run lint  # Shows all errors

# Frontend
cd frontend
npm run lint
```

Autofix most issues:
```bash
eslint 'src/**/*.ts' --fix
```

### 4. ❌ "Frontend build failed" in CI

**Symptoms:**
```
Error: next build failed
Error: Build failed with X warnings
```

**Causes:**
- TypeScript errors
- Missing environment variables
- Broken imports

**Solution:**

Build locally to identify issues:
```bash
cd frontend
npm run build

# Check for TypeScript errors
npx tsc --noEmit
```

### 5. ❌ "E2E tests failed" in CI

**Symptoms:**
```
Error: Test failed: cannot find test database
ECONNREFUSED: Connection refused
```

**Causes:**
- Services (PostgreSQL, Redis) not started yet
- Test database not seeded
- Migration didn't run

**Solution:**

Verify services in CI:
```bash
# The workflow already has health checks for PostgreSQL and Redis
# If tests still fail, the health check might be too short

# In .github/workflows/ci.yml:
postgres:
  services:
    health-check: 'pg_isready -U airman'
    health-interval: 10s  # Increase if tests are slow
    health-retries: 5

redis:
  services:
    health-check: 'redis-cli ping'
    health-interval: 10s
    health-retries: 5
```

---

## Step-by-Step: Debug CI/CD Locally

### 1. Simulate CI Environment

```bash
# Backend: CI uses minimal Node, no Docker
cd backend

# Install from clean state (CI uses npm ci)
rm -rf node_modules package-lock.json
npm ci

# Generate Prisma client (required before build)
npx prisma generate

# Run linting with zero tolerance (like CI)
npm run lint

# Run tests with coverage (must be ≥40%)
npm run test:cov

# Build for production
npm run build

# Run E2E tests (requires external postgres + redis)
# docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=airman postgres:16-alpine
# docker run -d -p 6379:6379 redis:7-alpine
# npm run test:e2e
```

### 2. Check What Workflow Sees

Go to: https://github.com/saiprasadreddy33/AIRMAN-Core/actions

Click on a failing workflow run:
- See which job failed (backend-quality, backend-integration, or frontend-quality)
- Click the job to expand logs
- Look for the first error message
- Search for the error below

### 3. Simulate Exact CI Commands

From repository root:

```bash
# Exact commands from .github/workflows/ci.yml

### Backend Quality
cd backend
npm ci
npx prisma generate
npm run lint
npm run test:cov
npm run build
cd ..

### Frontend Quality
cd frontend
npm ci
npm run lint
npx vitest run --coverage
npm run build
cd ..
```

If any fail, you've found the issue. Fix it and push to trigger CI again.

---

## GitHub Actions UI Navigation

1. **See all workflows:** https://github.com/saiprasadreddy33/AIRMAN-Core/actions
2. **See branches with failed workflows:** Look for red X on branches
3. **Re-run failed workflow:** Click workflow → click "Re-run jobs" → "Re-run failed jobs"
4. **View workflow file:** In repo, `.github/workflows/ci.yml`
5. **View job logs:** Click workflow run → click failing job name
6. **See PR check status:** Go to any PR → check "Checks" tab

---

## Common Fixes Summary

| Error | Quick Fix |
|-------|-----------|
| Coverage < 40% | Add tests or reduce untested code |
| Prisma migration failed | `prisma migrate reset --force` |
| ESLint errors | `eslint src --fix` |
| Tests failing | `npm run test:watch` to debug |
| Build failed | `npm run build` locally to find errors |
| Cannot connect to DB | Check PostgreSQL health check intervals |
| Cannot connect to Redis | Check Redis health check intervals |

---

## Prevention: Before Pushing

Always run locally before pushing:

```bash
# Backend
cd backend
npm run lint           # ✅ No errors
npm run test:cov       # ✅ Coverage ≥40%
npm run build          # ✅ Builds without errors

# Frontend
cd frontend
npm run lint           # ✅ No errors
npx vitest run --coverage  # ✅ Coverage ≥40%
npm run build          # ✅ Builds without errors

# If all pass locally, PR will likely pass in CI
```

---

## Monitoring CI/CD

**Before each PR:**
1. Run all local tests (shown above)
2. Verify coverage thresholds
3. Push to branch
4. Go to Actions tab
5. Wait for all jobs to pass (usually 10-15 min)
6. Now safe to create or update PR

**After PR created:**
1. Check Status tab in PR for green checkmarks
2. If any fail, click workflow for detailed logs
3. Make fixes locally and push updated commits
4. CI automatically re-runs

---

## Emergency: Manual Debug in CI

If you can't figure out why CI fails, add temporary debug logging:

```yaml
- name: Debug - List files
  run: find . -name "*.spec.ts" | head -20

- name: Debug - Show coverage
  run: cat coverage/coverage-summary.json || echo "No coverage yet"

- name: Debug - Show environment
  run: env | grep -E "NODE|npm|DB"
```

Then push, run workflow, and check logs. Remove debug steps after fixing.

---

## Resources

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Jest Coverage Config](https://jestjs.io/docs/configuration#coveragethreshold)
- [Vitest Coverage](https://vitest.dev/config/#coverage)
- [ESLint Configuration](https://eslint.org/docs/user-guide/configuring/)
- [Prisma Migrations](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate)
