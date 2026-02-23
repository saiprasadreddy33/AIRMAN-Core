# GitHub Branch Protection Setup

## Overview

Branch protection rules enforce code quality and prevent accidental pushes to critical branches. AIRMAN-Core uses a two-tiered approach:

1. **`main` (Production)** - Strict protection
2. **`develop` (Staging)** - Standard protection

## ⚙️ How to Configure

### Step 1: Go to Repository Settings
1. Navigate to https://github.com/saiprasadreddy33/AIRMAN-Core/settings/branches
2. Click on "Add rule"

### Step 2: Configure `main` Branch

**Branch name pattern:** `main`

**Required status checks:**
- ✅ `backend-quality` (must pass)
- ✅ `backend-integration` (must pass)
- ✅ `frontend-quality` (must pass)

**Other settings:**
- ✅ Require a pull request before merging
  - Required approving reviews: **1**
  - Require review from code owners: **No**
  - Dismiss stale pull request approvals when new commits are pushed: **Yes**
  - Require status checks to pass before merging: **Yes**
  - Require branches to be up to date before merging: **Yes**
  - Require signed commits: **No** (can enable if signing keys set up)
  - Require conversation resolution before merging: **Yes**

- ✅ Include administrators (enforce rules for admins too)

**After push:**
- ✅ Automatically delete head branches (clean up after merge)

---

### Step 3: Configure `develop` Branch

**Branch name pattern:** `develop`

**Required status checks:**
- ✅ `backend-quality` (must pass)
- ✅ `backend-integration` (must pass)
- ✅ `frontend-quality` (must pass)

**Other settings:**
- ✅ Require a pull request before merging
  - Required approving reviews: **0** (but CI/CD must pass)
  - Require status checks to pass before merging: **Yes**
  - Require branches to be up to date before merging: **Yes**

- ❌ Do NOT include administrators (allow emergency merges if needed)

**After push:**
- ✅ Automatically delete head branches

---

## Rule Enforcement Matrix

| Requirement | main | develop |
|------------|------|---------|
| Pull Request Required | ✅ Yes | ✅ Yes |
| Reviews Required | ✅ 1 approval | ⭕ 0 (CI/CD gates all) |
| Status Checks | ✅ All 3 jobs | ✅ All 3 jobs |
| Up-to-date Branch | ✅ Yes | ✅ Yes |
| Conversation Resolution | ✅ Yes | ⭕ No |
| Admin Enforcement | ✅ Yes | ⭕ No |
| Auto-delete Branch | ✅ Yes | ✅ Yes |

---

## What Gets Checked on PR

Every PR (to both `main` and `develop`) runs these GitHub Actions:

```yaml
Workflow: AIRMAN CI/CD Pipeline
├── Job 1: Backend Quality Gate
│   ├── Lint (ESLint) - Must pass
│   ├── Unit Tests (Jest) - Must pass
│   ├── Coverage Gate (≥40%) - Must pass
│   └── Build - Must pass
│
├── Job 2: Backend Integration Tests
│   ├── Spin up PostgreSQL - Must pass
│   ├── Spin up Redis - Must pass
│   ├── Run DB migrations - Must pass
│   └── Run E2E tests - Must pass
│
└── Job 3: Frontend Quality Gate
    ├── Lint (ESLint) - Must pass
    ├── Unit Tests (Vitest) - Must pass
    ├── Coverage Gate (≥40%) - Must pass
    └── Build (Next.js) - Must pass
```

If ANY of these fail, the PR cannot be merged (even if approved).

---

## When Rules Apply

| Scenario | Result |
|----------|--------|
| Push directly to `main` | ❌ BLOCKED |
| PR to `main` without 1 approval | ❌ BLOCKED |
| PR to `main` with failing tests | ❌ BLOCKED |
| PR to `main`, outdated branch | ❌ BLOCKED (require update) |
| PR to `develop` with failing tests | ❌ BLOCKED |
| Merge to `main` as admin | ✅ ALLOWED (protected setting) |
| Merge to `develop` as admin | ✅ ALLOWED if CI/CD passes |

---

## Common Scenarios

### ✅ Merging PR to `develop` - WORKS

```
1. Create feature/my-feature from develop
2. Push changes
3. Create PR: feature/my-feature → develop
4. GitHub Actions runs automatically
5. All 3 jobs pass ✅
6. Approve own PR (or self-merge if no approval needed)
7. Click "Merge" → Auto-deletes feature branch
8. Automatically deploys to dev environment
```

### ❌ Merging PR to `develop` - FAILS (Reasons)

```
❌ Backend tests failing → Fix and push
❌ Coverage < 40% → Add tests or reduce uncovered lines
❌ Frontend build failed → Fix build errors
❌ Feature branch outdated → Click "Update branch" to rebase
```

### ✅ Merging `develop` to `main` - WORKS

```
1. Create PR: develop → main
2. GitHub Actions runs automatically
3. All 3 jobs pass ✅
4. Approve PR (after review)
5. All conversations resolved
6. Click "Merge" → Creates production tag
7. Automatically deploys to staging
```

### 🔴 Emergency: Need to push to production immediately?

```
# Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-fix

# Fix issue
git commit -m "fix: critical issue"

# Push to remote
git push origin hotfix/critical-fix

# Create PR: hotfix → main
# Even though it's a hotfix, it must pass all CI/CD checks
# After merged to main, remember to merge back to develop
```

---

## Setting Up Code Owners (Optional)

For additional governance, create `.github/CODEOWNERS`:

```
# Root config files
.github/ @saiprasadreddy33
docker-compose.yml @saiprasadreddy33
prisma/ @saiprasadreddy33

# Backend
backend/src/ @saiprasadreddy33

# Frontend
frontend/src/ @saiprasadreddy33

# Docs
docs/ @saiprasadreddy33
```

Then enable "Require review from code owners" on `main`:
- Any PR touching these files requires approval from that owner

---

## Dismissing Stale Reviews

When enabled, if you push a new commit to a PR, previous approvals are dismissed. This ensures:
- Reviewers see latest changes
- No merging if feedback wasn't addressed
- Forces re-review of each update

**Recommended:** Keep this ENABLED for `main`

---

## FAQ

**Q: Can I push directly to main?**
A: No, branch protection prevents it. Create a feature branch and PR instead.

**Q: What if tests fail?**
A: Fix the failing test/lint/build issue, push again. GitHub Actions re-runs automatically.

**Q: Can I force push to develop?**
A: No, branch protection prevents force pushes. Use normal merge workflows.

**Q: How do I update an outdated branch?**
A: GitHub PR page shows "Update branch" button. Click it to rebase onto latest develop.

**Q: What if I'm an admin?**
A: Admins can still merge to `main` even if checks fail (if admin enforcement is OFF), but this is NOT RECOMMENDED. Rules exist for good reasons.

---

## Monitoring

Check branch protection is working:

1. Go to Settings → Branches
2. Verify both `main` and `develop` show "Branch protection rule"
3. Click each to review settings

Check CI/CD is passing:

1. Go to Pull Requests
2. Filter by: `is:open`
3. Each PR should show green checkmarks (✅) or red X (❌) for each status check

---

## Troubleshooting

**PR cannot merge - "Some checks haven't completed yet"**
- Wait for GitHub Actions to finish running (usually 10-15 minutes)
- Check Actions tab to see which job is running

**PR cannot merge - "Behind main"**
- Click "Update branch" to rebase feature onto latest main
- Or manually: `git fetch origin && git rebase origin/main`

**Need to merge without passing tests (emergency only)**
- Only possible if branch protection rule allows admin override
- NOT RECOMMENDED - indicates incomplete work
- Should update branch protection to not allow admin override for production safety

---

## Next Steps

1. ✅ Go to https://github.com/saiprasadreddy33/AIRMAN-Core/settings/branches
2. ✅ Configure protection rules for `main` and `develop`
3. ✅ Test by creating a feature branch and PR
4. ✅ Verify CI/CD runs and branch protection enforces rules
