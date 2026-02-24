# AIRMAN-Core

AIRMAN-Core is a multi-tenant flight training platform. It covers two areas: a scheduling system where instructors publish availability and students book sessions managed through an admin-controlled approval workflow, and a learning management system where instructors author courses with text lessons and MCQ quizzes that students complete online or offline.

The codebase enforces tenant isolation at the database layer, handles token refresh transparently, escalates unassigned bookings to admin via background jobs, and grades quizzes server-side so answers are never exposed to the client.

---

## Contents

- [Setup](#setup)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Authentication Flow](#authentication-flow)
- [Scheduling Workflow](#scheduling-workflow)
- [Learning Module](#learning-module)
- [Notification System](#notification-system)
- [Background Jobs](#background-jobs)
- [API Reference](#api-reference)
- [Demo Credentials](#demo-credentials)
- [Technical Decisions](#technical-decisions)
- [Deployment](#deployment)
- [Documentation Index](#documentation-index)
- [Troubleshooting](#troubleshooting)

---

## Setup

### Requirements

- Docker and Docker Compose v2
- Git
- No local Node.js or database needed — everything runs inside containers

### Running locally

```bash
git clone <repository-url>
cd AIRMAN-Core
docker compose up --build -d
```

On first run, the containers will:

1. Start PostgreSQL and run all Prisma migrations
2. Seed the database with demo tenants, users, courses, and bookings
3. Start Redis for the cache and BullMQ job queue
4. Start the NestJS API on port 3001
5. Start the Next.js frontend on port 3000
6. Start a separate BullMQ worker process for background jobs

Wait roughly 30 seconds for everything to be healthy:

```bash
docker compose ps
docker compose logs api --tail=20
```

Once you see `Application is running on: http://[::1]:3001`, the API is ready.

Open [http://localhost:3000](http://localhost:3000).

For detailed environment configuration, local development hot-reload setup, and how GitHub Actions CI/CD is configured per environment, see [docs/setup/ENVIRONMENT_SETUP.md](./docs/setup/ENVIRONMENT_SETUP.md) and [docs/setup/GITHUB_SETUP.md](./docs/setup/GITHUB_SETUP.md).

### Environment variables

The defaults in `docker-compose.yml` work for local development. For production or staging, override these:

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | set in compose |
| `REDIS_URL` | Redis connection string | set in compose |
| `JWT_SECRET` | Signs access tokens | change before deploying |
| `JWT_REFRESH_SECRET` | Signs refresh tokens | change before deploying |
| `JWT_EXPIRES_IN` | Access token lifetime | `1h` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime | `30d` |
| `ESCALATION_HOURS` | Hours before an unassigned booking triggers admin alert | `2` |

For the complete secrets rotation policy, environment comparison matrix (dev/staging/prod), and how secrets are injected in CI/CD, see [docs/deployment/DEPLOYMENT_GUIDE.md](./docs/deployment/DEPLOYMENT_GUIDE.md).

---

## Architecture

```
Browser (Next.js — port 3000)
          |
          | HTTP + Bearer token
          v
NestJS API (port 3001)
  |-- Auth module (JWT + Argon2 + refresh tokens)
  |-- Scheduling module
  |     |-- Availability (instructor time slots)
  |     |-- Bookings (state machine: requested → approved → assigned → completed)
  |-- Learning module
  |     |-- Courses, modules, lessons (TEXT + MCQ)
  |     |-- Quiz attempts (online + offline sync)
  |-- Users, Tenants
  |-- Notifications (console stubs, email-ready)
  |-- Common (guards, interceptors, cache, rate limiting)
          |
          |-- PostgreSQL (Prisma ORM)
          |-- Redis (BullMQ job queues + response caching)
          |
BullMQ Worker (separate container)
  |-- Booking escalation processor
        Fires after ESCALATION_HOURS if booking is still not assigned
        Marks escalation_required=true, notifies admins via NotificationsService
```

Data never crosses tenant boundaries. Every table has a `tenant_id` column, and every query includes a `WHERE tenant_id = ?` condition enforced in the service layer, not the controller.

The full system interconnection audit — covering which modules talk to which, shared dependencies, cache invalidation paths, and role enforcement per endpoint — is in [docs/architecture/INTERCONNECTION_AUDIT.md](./docs/architecture/INTERCONNECTION_AUDIT.md).

The 72-hour MVP breakdown with original design decisions is in [docs/architecture/PLAN.md](./docs/architecture/PLAN.md).

---

## Project Structure

```
AIRMAN-Core/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Single source of truth for the data model
│   │   └── seed.ts                # Seeds demo users, courses, and bookings
│   └── src/
│       ├── app.module.ts
│       ├── main.ts
│       ├── auth/                  # Login, refresh, logout, JWT strategy
│       ├── users/
│       ├── tenants/
│       ├── scheduling/
│       │   ├── availability/      # Instructor time slot management
│       │   └── bookings/
│       │       ├── bookings.service.ts
│       │       ├── bookings.controller.ts
│       │       ├── booking-escalation.processor.ts   # BullMQ worker job
│       │       ├── booking-status.enum.ts            # State machine rules
│       │       └── constants/escalation.constants.ts
│       ├── learning/              # Courses, modules, lessons, quiz grading
│       ├── notifications/
│       │   └── notifications.service.ts   # Structured event stubs
│       ├── common/
│       │   ├── guards/            # JwtAuthGuard, RolesGuard
│       │   ├── decorators/        # @Roles()
│       │   ├── cache/             # Redis wrapper with TTL
│       │   └── interceptors/      # AuditLogInterceptor
│       ├── bull/                  # BullMQ global configuration
│       └── prisma/                # PrismaService
├── frontend/
│   └── src/
│       ├── app/                   # Next.js app directory
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── SchedulePage.tsx
│       │   └── CoursesPage.tsx
│       ├── contexts/AuthContext.tsx
│       ├── lib/
│       │   ├── api.ts             # Fetch wrapper with automatic token refresh
│       │   └── auth.ts            # SHA-256 pre-hash before login
│       └── types/index.ts
├── docs/                          # Full documentation — see Documentation Index below
└── docker-compose.yml
```

---

## Authentication Flow

Login sends the password pre-hashed with SHA-256 in the browser before it leaves the client. The raw password never appears in network traffic. The backend receives the SHA-256 hex digest, then verifies it against the Argon2 hash stored in the database.

```
Client                           API
  |   POST /auth/login            |
  |   { email, sha256(password) } |
  |-----------------------------> |
  |                               | Argon2.verify(stored_hash, sha256_input)
  |   { accessToken }             |
  |   Set-Cookie: refreshToken    |
  |<-----------------------------|
```

The access token lives in session storage, expires after 1 hour. The refresh token is an HTTP-only cookie, valid for 30 days. The frontend API utility (`lib/api.ts`) intercepts 401 responses, calls `POST /auth/refresh` automatically, stores the new access token, and retries the original request without a page reload.

Rate limiting on login: 5 attempts per minute per IP. Other endpoints: 60 requests per minute.

The full RBAC implementation — role definitions, what each role can access at the route level, how guards are stacked, and the complete permission matrix — is documented in [docs/architecture/AUTH-RBAC.md](./docs/architecture/AUTH-RBAC.md).

---

## Scheduling Workflow

The booking follows a strict one-way state machine:

```
requested  -->  approved  -->  assigned  -->  completed
    |               |              |
    v               v              v
cancelled       cancelled      cancelled
```

Invalid transitions are rejected at the service layer. Any attempt to skip a step returns a 400.

**Role responsibilities per state:**

| State | Who acts | Available actions |
|---|---|---|
| (none) | Instructor | Creates availability slot |
| (none) | Student | Books a slot — booking enters `requested` |
| `requested` | Admin | Approve or cancel |
| `approved` | Admin | Assign (confirms session) or cancel |
| `assigned` | Instructor or Admin | Mark completed or cancel |

**Conflict detection:** When a student books, the system checks whether another booking at `approved` or `assigned` status already overlaps for that instructor. Bookings at `requested`, `completed`, or `cancelled` do not block new bookings for the same time range.

**Escalation:** When a booking moves to `approved`, a delayed BullMQ job is enqueued (default 2 hours, configurable via `ESCALATION_HOURS`). If the booking is still not `assigned` when the job fires, it is flagged `escalation_required = true` and admins are notified. If it was assigned before the timer fires, the job exits silently.

**Frontend flow:** Booking status changes trigger Sonner toast notifications in the UI. Students get a confirmation toast on booking submission. Admins and instructors see success messages on each state transition.

---

## Learning Module

Courses are organized as: Course → Module → Lesson. A lesson is either `TEXT` (markdown rendered in the browser) or `MCQ` (multiple-choice quiz).

When a student opens a quiz, the API returns questions and options but omits `correct_option`. The student submits their selected answers, the server grades them, and returns the score. This means no client-side code ever has access to correct answers before submission.

Quiz attempts support offline submission. Students can complete a quiz without internet; the browser stores answers in IndexedDB. When connectivity is restored, attempts sync to the server via `POST /lessons/sync-attempt`. The server deduplicates using a `clientId` field to prevent the same attempt being graded twice.

Full implementation details for offline quiz sync, the IndexedDB schema, retry logic, and the deduplication strategy are in [docs/features/OFFLINE_QUIZ_IMPLEMENTATION.md](./docs/features/OFFLINE_QUIZ_IMPLEMENTATION.md).

---

## Notification System

All notifications are implemented as structured console log output. They are formatted as email payloads — with `to`, `subject`, and `body` fields — so swapping in a real mailer requires only updating `notifications.service.ts`.

| Event | Triggered when |
|---|---|
| `BOOKING_REQUESTED` | Student creates a booking |
| `BOOKING_APPROVED` | Admin approves |
| `BOOKING_ASSIGNED` | Admin assigns instructor |
| `BOOKING_COMPLETED` | Instructor or admin marks complete |
| `BOOKING_CANCELLED` | Anyone cancels |
| `ESCALATION_REQUIRED` | Booking not assigned within SLA window |

---

## Background Jobs

The BullMQ worker runs as a separate Docker container connected to the same Redis instance as the API.

Escalation job configuration:
- Delay: `ESCALATION_HOURS * 3600 * 1000` ms (default 2 hours)
- Max attempts: 3, exponential backoff with a 5-second base
- Failed jobs are retained in Redis for inspection (`removeOnFail: false`)
- Completed jobs are removed automatically (`removeOnComplete: true`)

If a job exhausts all retry attempts, the `@OnWorkerEvent('failed')` handler logs the failure with full context. This acts as the dead-letter mechanism — jobs that permanently fail do not disappear silently.

---

## API Reference

All endpoints except `POST /auth/login` and `POST /auth/refresh` require:
```
Authorization: Bearer <access_token>
```

Paginated list endpoints accept `?page=1&limit=10`.

---

### Authentication

**Login**
```
POST /auth/login
Content-Type: application/json

{
  "email": "admina@test.com",
  "password": "<sha256 hex of plaintext password>"
}
```

The frontend handles the SHA-256 hashing automatically. If you are calling the API directly:
```bash
echo -n "password" | sha256sum
# 5e884898da28047151d0e56f8dc62927273ec1... (use this as the password field)
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "admina@test.com",
    "name": "Admin Alpha",
    "role": "admin",
    "tenant_id": "..."
  }
}
```

**Refresh token**
```
POST /auth/refresh
```
Requires the `refreshToken` HTTP-only cookie. Returns a new `accessToken`.

**Logout**
```
POST /auth/logout
```
Clears the refresh token cookie and invalidates the session.

---

### Availability

**List all availability for your tenant**
```
GET /availability?page=1&limit=20
```

**List by instructor**
```
GET /availability/instructor/:instructorId
```

**Create a slot** (instructor or admin)
```
POST /availability
{
  "start_time": "2026-03-01T09:00:00Z",
  "end_time": "2026-03-01T10:00:00Z"
}
```
Returns 409 if the time overlaps an existing slot for that instructor.

**Update a slot** (instructor or admin)
```
PATCH /availability/:id
{ "start_time": "2026-03-01T09:30:00Z" }
```

**Delete a slot** (instructor or admin)
```
DELETE /availability/:id
```

---

### Bookings

**List bookings** (role-scoped automatically)
```
GET /bookings?page=1&limit=50
```
Students see only their own bookings. Instructors see only bookings where they are assigned. Admins see all bookings for the tenant.

**Create a booking**
```
POST /bookings
{
  "instructor_id": "...",
  "start_time": "2026-03-01T09:00:00Z",
  "end_time": "2026-03-01T10:00:00Z"
}
```
`student_id` is optional — defaults to the authenticated user's ID. Returns 409 if the instructor has a conflicting `approved` or `assigned` booking.

**Approve** (admin or instructor)
```
PATCH /bookings/:id/approve
```

**Assign** (admin or instructor)
```
PATCH /bookings/:id/assign
```

**Complete** (admin or instructor)
```
PATCH /bookings/:id/complete
```

**Cancel** (any role, within allowed state transitions)
```
PATCH /bookings/:id/cancel
```

All state-change endpoints return the full updated booking with `instructor` and `student` name/email fields included.

---

### Courses and Lessons

**List courses**
```
GET /courses?page=1&limit=10
```

**Get modules for a course**
```
GET /courses/:id/modules
```

**Get lessons in a module**
```
GET /modules/:id/lessons
```

**Get a lesson** (MCQ lessons omit `correct_option`)
```
GET /lessons/:id
```

**Submit quiz answers**
```
POST /lessons/:id/attempt
{
  "answers": [0, 2, 1, 3]
}
```
`answers` is an array of selected option indices in question order.

Response:
```json
{
  "score": 3,
  "total": 4,
  "incorrectQuestions": [
    { "questionId": "...", "correctAnswer": 2 }
  ]
}
```

**Sync an offline attempt**
```
POST /lessons/sync-attempt
{
  "lessonId": "...",
  "clientId": "attempt_1708702000000_abc123",
  "answers": [0, 2, 1, 3]
}
```
Submitting the same `clientId` twice returns the original result without re-grading.

---

### Error Responses

| Code | Meaning |
|---|---|
| 400 | Validation failed or invalid state transition |
| 401 | Missing or expired token |
| 403 | Role not permitted for this action |
| 404 | Resource not found within your tenant |
| 409 | Conflict — double booking or overlapping availability |
| 429 | Rate limit exceeded |

---

## Demo Credentials

The seed creates two fully isolated tenants.

**Tenant: Alpha Flying School**

| Role | Email | Password |
|---|---|---|
| Admin | admina@test.com | password |
| Instructor | instructora@test.com | password |
| Student | studenta@test.com | password |

**Tenant: Beta Aviation**

| Role | Email | Password |
|---|---|---|
| Admin | adminb@test.com | password |
| Instructor | instructorb@test.com | password |
| Student | studentb@test.com | password |

Logging in as `admina@test.com` will never surface data from Beta Aviation. The isolation is enforced at the query layer on every request.

**End-to-end walkthrough:**

1. Log in as `instructora@test.com` and create an availability slot under Schedule
2. Log out, log in as `studenta@test.com` and book that slot
3. Log out, log in as `admina@test.com`
4. Approve the booking, then assign it
5. Log back in as `instructora@test.com` and mark the session complete
6. Optional: log back as admin and observe the booking history with full timestamps

---

## Technical Decisions

### Tenant isolation at the query layer

Each table has a `tenant_id` column rather than separate PostgreSQL schemas per tenant. The reason is operational simplicity — one connection pool, one migration path. The tradeoff is that the application is responsible for always including the filter. We address this by enforcing it in service methods, not controllers, so the constraint is as close to the data as possible. No query can reach the database without going through a service that adds this clause.

### Argon2 for password hashing

Argon2id was chosen over bcrypt. Argon2 wins on memory-hardness, which is the relevant dimension for GPU-based cracking. bcrypt is fine and widely deployed, but Argon2 is the winner of the Password Hashing Competition and the current OWASP recommendation. The tradeoff is less ecosystem familiarity — most Node.js developers have worked with bcrypt, not argon2.

### SHA-256 in the browser before login

Passwords are pre-hashed in the browser with `crypto.subtle.digest` before the login request is sent. The cleartext password does not appear in network logs, proxy logs, or server-side request logging. The tradeoff: the SHA-256 hex is effectively the credential from the server's perspective. This is mitigated by HTTPS and the fact that the hash is never stored anywhere except as input to Argon2.

### HTTP-only cookie for refresh token

Access tokens go in session storage. Refresh tokens go in an HTTP-only cookie. Session storage tokens are accessible to JavaScript (needed for attaching to requests). HTTP-only cookies cannot be read by JavaScript, making them resistant to XSS. The cookie carries `SameSite=Strict`.

### Redis for caching reads only

Cache entries are set for availability and booking list responses with a 300-second TTL. Writes always invalidate the relevant tenant's cache immediately. We do not attempt read-your-writes cache consistency. The rule is simple: any mutation clears the cache, any read may be served from cache. Predictable and easy to reason about.

### BullMQ over cron for escalation

A cron job fires on a schedule regardless of whether there is work. BullMQ jobs are created per booking and fire relative to the booking's approval time. This means the SLA countdown starts at approval, not at the next cron tick. BullMQ also provides retries, dead-letter storage, and job visibility without additional infrastructure.

### Server-side quiz grading

Quiz questions are returned without `correct_option`. The client sends back selected answer indices. The server grades and returns the result. There is no API endpoint that exposes correct answers to an authenticated client. The only way to see correct answers is to submit an attempt. This design is covered in more detail in the [authentication and architecture docs](./docs/architecture/AUTH-RBAC.md).

### What we deliberately did not build

Several features were scoped out. The specific decisions, reasoning, impact assessment, and the planned timeline for adding them are documented in [docs/incidents/CUTS.md](./docs/incidents/CUTS.md). Short version: full test coverage, full-text search, attribute-level access control (CASL), and Redis SCAN-based cache invalidation were all evaluated and deferred. The reasoning for each is not "we forgot" — it is written out with tradeoffs and re-evaluation criteria.

---

## Deployment

The project has three environments: local development, staging, and production. Each uses a separate Docker Compose file and a separate set of secrets.

- Local: `docker compose up --build -d`
- Staging: merging to `develop` triggers the GitHub Actions staging workflow
- Production: merging to `main` with a git tag triggers the production workflow, which requires manual approval

For the complete deployment guide including CI/CD pipeline configuration, secrets rotation schedule, rollback procedures, and the emergency rollback script, see [docs/deployment/DEPLOYMENT_GUIDE.md](./docs/deployment/DEPLOYMENT_GUIDE.md).

For rollback specifically, see [docs/deployment/ROLLBACK_STRATEGY.md](./docs/deployment/ROLLBACK_STRATEGY.md). It covers four rollback scenarios with estimated recovery times.

For how secrets are managed per environment and what to do if a secret is compromised, see [docs/security/SECRETS_MANAGEMENT.md](./docs/security/SECRETS_MANAGEMENT.md).

For Git branching conventions and branch protection rules, see [docs/setup/BRANCHING_STRATEGY.md](./docs/setup/BRANCHING_STRATEGY.md) and [docs/setup/BRANCH_PROTECTION.md](./docs/setup/BRANCH_PROTECTION.md).

Pre-deployment checklist (local to staging):

```bash
npm run lint       # in backend/ and frontend/
npm run test       # in backend/
npm run build      # in frontend/
docker compose ps  # verify all containers healthy
```

---

## Documentation Index

All extended documentation lives in `docs/`. Each file covers a specific area in full. The README you are reading summarises the system. The docs below contain the complete treatment.

| Document | What it covers |
|---|---|
| [docs/README.md](./docs/README.md) | Navigation index for all docs |
| [docs/architecture/PLAN.md](./docs/architecture/PLAN.md) | 72-hour MVP breakdown, original design rationale |
| [docs/architecture/AUTH-RBAC.md](./docs/architecture/AUTH-RBAC.md) | Complete role/permission matrix, JWT strategy, guard chain |
| [docs/architecture/INTERCONNECTION_AUDIT.md](./docs/architecture/INTERCONNECTION_AUDIT.md) | Which modules depend on which; full system map |
| [docs/setup/ENVIRONMENT_SETUP.md](./docs/setup/ENVIRONMENT_SETUP.md) | Local dev setup, hot-reload, environment variables |
| [docs/setup/GITHUB_SETUP.md](./docs/setup/GITHUB_SETUP.md) | GitHub Actions, secrets, environment creation |
| [docs/setup/BRANCHING_STRATEGY.md](./docs/setup/BRANCHING_STRATEGY.md) | Git branching model, PR flow |
| [docs/setup/BRANCH_PROTECTION.md](./docs/setup/BRANCH_PROTECTION.md) | Branch protection rules setup on GitHub |
| [docs/deployment/DEPLOYMENT_GUIDE.md](./docs/deployment/DEPLOYMENT_GUIDE.md) | Dev/staging/prod deployment steps, secrets reference |
| [docs/deployment/ROLLBACK_STRATEGY.md](./docs/deployment/ROLLBACK_STRATEGY.md) | Rollback procedures and recovery time targets |
| [docs/deployment/CI_CD_TROUBLESHOOTING.md](./docs/deployment/CI_CD_TROUBLESHOOTING.md) | Common GitHub Actions failures and fixes |
| [docs/features/OFFLINE_QUIZ_IMPLEMENTATION.md](./docs/features/OFFLINE_QUIZ_IMPLEMENTATION.md) | Offline quiz taking with IndexedDB, sync, deduplication |
| [docs/security/SECRETS_MANAGEMENT.md](./docs/security/SECRETS_MANAGEMENT.md) | Secrets per environment, rotation, compromise response |
| [docs/incidents/CUTS.md](./docs/incidents/CUTS.md) | Deliberately skipped features with tradeoff reasoning |
| [docs/incidents/POSTMORTEM.md](./docs/incidents/POSTMORTEM.md) | Post-incident analysis from the build |

---

## Troubleshooting

**API container exits on startup**
```bash
docker compose logs api
```
Almost always a database connection timeout on first boot. The API restarts automatically. If it keeps failing, verify `DATABASE_URL` in your compose file.

**Migrations not applied**
```bash
docker compose exec api npx prisma migrate deploy
```

**Stale cache data after code changes**
```bash
docker compose exec redis redis-cli FLUSHALL
```

**Port conflict**
The compose file uses 3000 (frontend), 3001 (API), 5432 (Postgres), 6379 (Redis). Change the host side of any port mapping in `docker-compose.yml` if there is a conflict.

**Re-seed the database**
```bash
docker compose exec api npm run prisma:seed
```

**Run backend tests**
```bash
cd backend && npm run test
```

For CI-related failures, see [docs/deployment/CI_CD_TROUBLESHOOTING.md](./docs/deployment/CI_CD_TROUBLESHOOTING.md).
