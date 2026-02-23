# Git Branching Strategy

## Overview

AIRMAN-Core uses a **Modified GitHub Flow** with two primary branches:

```
main (production)      ← Release branch - always stable, tagged releases
     ↑
develop (staging)      ← Integration branch - tests run here
     ↑
feature/* (PRs)        ← Individual feature branches
```

## Branches Explained

### 🟢 `main` - Production Branch

**Purpose:** Live production code
- Only receives merges from `develop`
- Always tagged with semantic versions (v1.0.0, v1.1.0, etc.)
- Requires all CI/CD gates to pass
- Requires pull request review
- Automatically deploys to production/staging

**When to merge here:**
```bash
# After develop is tested and ready for release
git checkout main
git pull origin main
git merge develop
git tag v1.1.0
git push origin main --tags
```

### 🟡 `develop` - Integration Branch

**Purpose:** Staging/integration area where features are tested together
- Receives feature branch PRs
- Runs full CI/CD pipeline (tests, coverage, builds)
- Automatically deploys to dev environment
- Requires CI/CD to pass before merge

**When to merge here:**
```bash
# After feature is complete and PR approved
git checkout develop
git pull origin develop
git merge feature/your-feature
```

### 🔵 `feature/*` - Feature Branches

**Purpose:** Isolated development of individual features
- Branch from `develop`
- One feature per branch: `feature/offline-quiz`, `feature/audit-logs`
- Require PR with CI/CD validation before merging

**Creating a feature branch:**
```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature

# Make changes, test locally
git add .
git commit -m "feat: description of your feature"
git push origin feature/your-feature

# Create PR on GitHub: feature → develop
```

### 🔴 Hotfix Branches (Emergency Only)

**Purpose:** Critical production fixes
- Branch directly from `main`
- Merge back to both `main` and `develop` after fix

```bash
git checkout main
git pull origin main
git checkout -b hotfix/critical-security-fix

# Make minimal fix
git commit -m "fix: critical issue"

# Merge to main first
git push origin hotfix/critical-security-fix
# Create PR: hotfix → main

# After merged, also merge to develop
git checkout develop
git pull origin develop
git merge main
git push origin develop
```

## Pull Request Workflow

### Creating a PR

1. **Create feature branch from develop:**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/my-feature
   ```

2. **Make changes, commit regularly:**
   ```bash
   git commit -m "feat: add offline quiz support"
   git commit -m "test: add offline quiz tests"
   ```

3. **Push to remote:**
   ```bash
   git push origin feature/my-feature
   ```

4. **Create PR on GitHub:**
   - Base: `develop`
   - Compare: `feature/my-feature`
   - Title: "feat: description"
   - Description: Why this change?

### PR Checks (Automated)

Every PR runs these checks and must pass:
- ✅ Backend unit tests (coverage ≥40%)
- ✅ Backend integration tests (DB + Redis)
- ✅ Frontend unit tests (coverage ≥40%)
- ✅ Linting (ESLint)
- ✅ Builds (Next.js + NestJS)

See `.github/workflows/ci.yml` for the full pipeline.

### Merging a PR

1. **Review & Approve**
   - At least 1 approval required (can be self)
   - All CI/CD checks must pass
   - Branch must be up to date with develop

2. **Merge**
   - Use "Squash and merge" for feature branches (keeps history clean)
   - Delete head branch after merge (auto-enabled)

3. **After merge**
   - Pull latest develop locally
   - Delete local feature branch
   ```bash
   git checkout develop
   git pull origin develop
   git branch -d feature/my-feature
   ```

## Protected Branches

### `main` Protection Rules

- ✅ Require 1 pull request review
- ✅ Require status checks to pass (all CI/CD jobs)
- ✅ Require branches to be up to date before merge
- ✅ Include administrators (no one skips this)

### `develop` Protection Rules

- ✅ Require status checks to pass (all CI/CD jobs)
- ✅ Require branches to be up to date before merge
- ✅ Auto-delete head branch after merge

## Deployment Pipeline

```
Feature PR → develop
    ↓ (CI/CD passes)
Feature merges to develop
    ↓ (All tests pass)
    Deploy to: dev environment 🟢
    ↓
Develop PR → main
    ↓ (Manual: Git tag v1.x.x)
Develop merges to main
    ↓ (All tests pass)
    Deploy to: staging ↑ main
    ↓
Approval check
    ↓
Deploy to: production (manual trigger)
```

## Common Workflows

### Starting New Feature
```bash
# Update develop, create feature branch
git checkout develop
git pull origin develop
git checkout -b feature/descriptive-name

# Work and commit
git add .
git commit -m "feat: what you built"
git commit -m "test: additional tests"

# Push and create PR
git push origin feature/descriptive-name
# Create PR on GitHub (feature → develop)
```

### Updating Feature During PR Review
```bash
# Keep your branch up to date, push more commits
git commit -m "fix: address review feedback"
git push origin feature/descriptive-name
# PR auto-updates, re-runs CI/CD
```

### Switching Between Branches
```bash
# List all branches
git branch -a

# Switch to existing branch
git checkout branch-name

# Pull latest changes
git pull origin branch-name

# Delete local branch
git branch -d feature/done-with-this
```

## Branch Naming Conventions

Use descriptive names with prefixes:

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/*` | `feature/offline-quiz` |
| Bug Fix | `fix/*` | `fix/auth-token-refresh` |
| Hotfix | `hotfix/*` | `hotfix/data-leak-security` |
| Documentation | `docs/*` | `docs/api-reference` |
| Refactor | `refactor/*` | `refactor/audit-service` |

## Troubleshooting

### "Your branch is behind origin/develop"
```bash
git fetch origin
git rebase origin/develop
git push origin feature/your-feature --force-with-lease
```

### "Merge conflict"
```bash
# Update from develop
git fetch origin
git rebase origin/develop

# Fix conflicts in editor, then:
git add .
git rebase --continue
git push origin feature/your-feature --force-with-lease
```

### "Accidentally committed to main"
```bash
# Create new branch from current main
git checkout -b feature/your-feature

# Reset main to before your commit
git checkout main
git reset --hard origin/main
```

### "Want to discard all local changes"
```bash
git fetch origin
git reset --hard origin/develop
```

## Resources

- [GitHub Docs: Branching Strategy](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests)
- [Git Workflow Best Practices](https://git-scm.com/book/en/v2)
- See [CI/CD Configuration](./.github/workflows/ci.yml) for automated checks
