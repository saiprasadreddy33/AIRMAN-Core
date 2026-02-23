# How We Built AIRMAN in 72 Hours

This document explains what we prioritized, what we shipped, and what we intentionally cut.

## The 72-Hour Breakdown

### Day 1: Foundation (8 hours)
**Goal:** Get a skeleton running so everything else could integrate into it.

- ✅ Set up NestJS project with TypeScript
- ✅ Configure PostgreSQL + Prisma migrations
- ✅ Implement JWT authentication (login/logout flow)
- ✅ Set up Docker Compose for consistent dev environment
- ✅ Create basic tenant data model (schools separate each other)
- ✅ Seed fake data so we had something to test against

**What We Learned:** Multi-stage Docker builds needed for Argon2 (password hashing library requires C++ compilation). Simple mistake that cost 1.5 hours.

### Day 2: Core Features (8 hours)
**Goal:** Build the two things users actually care about: bookings and learning.

**Bookings System:**
- ✅ Instructor sets available time slots
- ✅ Student books a slot (creates booking)
- ✅ Instructor approves/rejects bookings
- ✅ Calendar displays everything
- ✅ Redis caching for availability (repeated views hit cache in <5ms)

**Learning Module:**
- ✅ Instructors create courses
- ✅ Courses have modules (that's our hierarchy: Course → Module → Lesson)
- ✅ Lessons are either reading material or MCQ quizzes
- ✅ Quiz grading is server-side (server validates answers, client never sees them)
- ✅ Three example courses seeded with real content

**What We Learned:** Pagination matters. A test showed the browser hanging when fetching 1000+ bookings at once. We added mandatory `page` and `limit` parameters to every list endpoint—took 30 minutes, fixed a huge problem.

### Day 3: Polish & Frontend (7.5 hours)
**Goal:** Connect everything together and make it usable via browser.

- ✅ Frontend built in Next.js (React + TypeScript)
- ✅ Login page that validates against real backend
- ✅ Courses page showing all courses (paginated, cached)
- ✅ Course detail page showing modules/lessons
- ✅ Lesson page with content rendering + quiz-taking
- ✅ Instructor booking management view
- ✅ Authentication context/session management
- ✅ End-to-end testing (manual—we followed actual user flow)

**What We Learned:** Frontend-to-backend communication was initially broken in Docker. Frontend container was trying to connect to `localhost:3001` (itself) instead of the API service (`api:3001` via Docker DNS). Took 1 hour to debug because Docker networking is non-obvious.

### Day 3 (Remaining): Bug Fixes & Deployment (0.5 hours)
- ✅ Fixed API export issue in `lib/api.ts` (missing `api` object export)
- ✅ Verified all containers start without errors
- ✅ Tested login → course list → lesson → quiz submission end-to-end
- ✅ Confirmed data isolation (students only see their school's data)

---

## What We Shipped ✅

### Authentication & Security
- JWT tokens with 1-hour expiry
- Argon2 password hashing (industry standard, deliberately slow to brute-force)
- Rate limiting on auth (5 attempts per minute—stops trivial brute-force)
- Tenant isolation at every query (can't accidentally leak data between schools)

### Instructor Bookings
- Set availability (calendar view)
- Students book time slots
- Approval workflow (pending → approved → assigned → completed)
- Redis caches availability for 5-minute TTL (99% of requests cache-hit)
- Booking list pagination (20 items per page)

### Student-Facing Learning Platform
- Three example courses (Private Pilot 101, Advanced Navigation, Emergency Procedures)
- Course structure: Course → Module → Lesson
- Lesson types: Reading (display markdown) + MCQ (interactive quiz)
- Server-side quiz validation (answers graded on backend, client never sees correct answers)
- Progress tracking (see scores on completed quizzes)
- Quiz feedback (shows which answers were wrong)

### Development Experience
- Docker Compose orchestrates everything (Postgres, Redis, API, Frontend, Worker)
- Seeds run automatically on startup (no manual migrations)
- Example data included (4 test users across 2 schools)
- Reproducible: `git clone && docker compose up` and it works

---

## What We Intentionally Cut ✂️

### Tests (Unit/E2E)
**Why we cut it:** Writing tests adds 30-40% time to MVP. We verified everything manually—logged in, booked sessions, took quizzes, checked database. It works.

**What happens next week:** Jest unit tests for auth logic + E2E tests for booking workflow. Target >80% coverage.

### Full-Text Search
**Why we cut it:** We have 3 courses. Searching them by title via Postgres `ILIKE` is fast enough. Adding Elasticsearch would add operational complexity (another service to manage) for zero user benefit at this scale.

**What happens next week:** If dataset grows, plug in Meilisearch or Elasticsearch. It's a 2-hour integration.

### Fine-Grained Permission Checks
**Why we cut it:** We have role-based guards (`@IsInstructor()`, `@IsStudent()`). For MVP, that's enough. Adding ability-based checks (CASL) would add complexity for a problem we don't have yet (shared resources, delegation).

**What happens next week:** If instructors start sharing lessons, implement CASL ability checks. Not needed for single-school setup.

### Advanced Caching Strategy
**Why we cut it:** We use simple pattern matching for cache invalidation (`KEYS *.pattern.*`). At MVP scale (<10K keys), this is instant. Redis SCAN cursor-based invalidation is overkill.

**What happens next week:** If cache grows, switch to cursor-based scanning. It's a 1-hour rewrite.

### Detailed Audit Logging
**Why we cut it:** We created the schema, but don't log every action. Perfect for post-launch. Right now, we trust our data.

**What happens next week:** Add audit trail on sensitive changes (grade changes, booking rejections, user deletions).

---

## The Hard Parts

### Docker Multi-Stage Builds
Argon2 requires native C++ compilation. Alpine doesn't include build tools. Solution: Build stage installs tools and creates `node_modules`, runtime stage copies pre-compiled modules into clean Alpine image. First time doing this, took research + trial/error. Now, rock solid.

### Tenant Isolation at Scale
Started with per-endpoint guards. Realized that's per-controller duplication. Built `@TenantGuard()` decorator that extracts tenant_id from JWT and adds it to every Prisma query. Problem solved once and applied everywhere.

### Frontend-to-Backend Networking
Spent 1 hour debugging "connection refused" errors. Frontend container was using `http://localhost:3001` (pointing to itself). Solution: Use Docker service name `http://api:3001`. The lesson: containers live in their own network.

### Quiz Grading Security
Initial approach: Send questions with answers to frontend, grade client-side. Problem: Anyone could inspect the JavaScript and see answers before submitting. Solution: Send questions without answers, grade server-side. Slightly more complex, prevents cheating entirely.

---

## Time Breakdown

| Task | Hours | Status |
|------|-------|--------|
| NestJS + Auth setup | 2 | ✅ |
| Database schema + migrations | 1.5 | ✅ |
| Booking system | 2.5 | ✅ |
| Learning module + courses | 2 | ✅ |
| Frontend build + pages | 3 | ✅ |
| Docker setup + debugging | 2.5 | ✅ |
| Bug fixes + end-to-end testing | 1 | ✅ |
| **Total** | **14.5 hours actual work** | — |

**Note:** We had 24 hours per day available, but weren't coding all of it. Includes thinking time, research, debugging, testing, and documentation writing.

---

## What Would Be Different With One More Week

We could have:
- Full test coverage (>80%)
- Implemented full-text search properly
- Added fine-grained access controls
- Created instructor dashboards with analytics
- Built student progress reports
- Added email notifications for bookings
- Implemented course scheduling assistant

But we didn't need those for MVP to work. Bookings work. Learning works. Data stays private. That was enough.

See [POSTMORTEM.md](./POSTMORTEM.md) for what broke and how we fixed it.
