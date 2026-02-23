# AIRMAN-Core Documentation

Complete documentation for the AIRMAN platform split into organized categories.

## 📋 Quick Navigation

### 🚀 [Setup & Getting Started](./setup/)
- [Environment Setup Guide](./setup/ENVIRONMENT_SETUP.md) - Configure local development environment
- [GitHub Setup Guide](./setup/GITHUB_SETUP.md) - Repository and GitHub Actions configuration
- [Branching Strategy](./setup/BRANCHING_STRATEGY.md) - Git workflow and branch management
- [Branch Protection Rules](./setup/BRANCH_PROTECTION.md) - How to configure protected branches on GitHub

### 🏗️ [Architecture & Design](./architecture/)
- [System Architecture Plan](./architecture/PLAN.md) - 72-hour MVP breakdown and design decisions
- [Authentication & RBAC](./architecture/AUTH-RBAC.md) - Role-based access control and security model
- [Interconnection Audit](./architecture/INTERCONNECTION_AUDIT.md) - Complete system interconnections verification

### 🚀 [Deployment & Operations](./deployment/)
- [Deployment Guide](./deployment/DEPLOYMENT_GUIDE.md) - Production deployment procedures
- [Rollback Strategy](./deployment/ROLLBACK_STRATEGY.md) - Emergency rollback procedures
- [CI/CD Troubleshooting](./deployment/CI_CD_TROUBLESHOOTING.md) - Fix GitHub Actions failures

### ✨ [Features & Implementation](./features/)
- [Offline-First Quiz Attempts](./features/OFFLINE_QUIZ_IMPLEMENTATION.md) - Offline quiz taking with sync

### 🔒 [Security & Compliance](./security/)
- [Secrets Management](./security/SECRETS_MANAGEMENT.md) - Environment variables and secrets handling

### 📊 [Incidents & Learnings](./incidents/)
- [Postmortem Analysis](./incidents/POSTMORTEM.md) - Post-incident review and improvements
- [Cuts & Decisions](./incidents/CUTS.md) - Features intentionally skipped and why

---

## Directory Structure

```
docs/
├── README.md (this file)
├── setup/ - Getting started and initial configuration
├── architecture/ - System design and interconnections
├── deployment/ - Production and rollback procedures
├── features/ - Detailed feature implementations
├── security/ - Secrets and compliance documentation
└── incidents/ - Post-mortems and lessons learned
```

## First Time Here?

1. **Start with** [Environment Setup](./setup/ENVIRONMENT_SETUP.md)
2. **Understand the design** in [System Architecture Plan](./architecture/PLAN.md)
3. **Review security** in [Authentication & RBAC](./architecture/AUTH-RBAC.md)
4. **Learn about new features** like [Offline Quizzes](./features/OFFLINE_QUIZ_IMPLEMENTATION.md)

## Contributing

When adding new documentation:
- Place it in the appropriate category folder
- Update this README with the new link
- Follow the existing formatting and structure
