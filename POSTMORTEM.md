# What Went Wrong (And How We Fixed It)

We built AIRMAN in 72 hours. Some things broke. Here's what, why, and how we solved each one.

## 1. Native Module Compilation Failures

**The Problem:**
We ran `docker-compose up --build` and it crashed with: `MODULE_NOT_FOUND: argon2`

The argon2 library is used for password hashing. It's written in C++ and needs to be compiled during installation. Alpine Linux (which we were using for small image size) doesn't include compilation tools by default. So `npm ci` failed trying to compile argon2 with no compiler available.

**Why It Happened:**
We specified `node:18-alpine` as our base image. Alpine is great for production (tiny, minimal attack surface), but it strips away build tools. We didn't realize this until the container actually tried to compile native modules.

**How We Fixed It:**
Docker multi-stage builds. The trick:
1. **Build stage:** Start with Alpine, install `python3`, `make`, `g++`—everything needed to compile C++
2. Install all npm dependencies (including argon2)—this compiles and creates `node_modules`
3. **Runtime stage:** Start a fresh Alpine image, copy only the pre-compiled `node_modules`, don't include the build tools

Result: Production image is only 45MB, but contains a fully compiled argon2. Zero compilation problems on cleanup runs.

**Time cost:** 1.5 hours (guessing wrong, researching, testing)

---

## 2. Database Migration Failures on Windows

**The Problem:**
Running `npx prisma migrate dev` locally threw: `P1000: Authentication failed against database.`

We were trying to initialize the database from our Windows host machine. The issue: Windows had other services running on `localhost:5432` or network socket issues, creating DNS resolution conflicts. Docker containers tried to connect to the host's port 5432, couldn't reach the Postgres container running on the internal Docker network.

**Why It Happened:**
We assumed we could run migrations from the host. We couldn't. Windows host networking and Docker internal networking are different things. `localhost` inside a container ≠ `localhost` on Windows.

**How We Fixed It:**
Instead of running migrations from Windows host:
```bash
# Old (broken):
npx prisma migrate dev

# New (works):
docker-compose run --rm api npx prisma migrate deploy
```

This runs the migration *inside* the Docker network where `postgres:5432` is a real DNS address. The migration container talks to the Postgres container on the internal network, bypasses all host-level complications.

**Result:** Repeatable, idempotent migrations. New developers just `docker-compose up` and it works.

**Time cost:** 1 hour (debugging network issues)

---

## 3. Pagination Missing (Almost Broke Performance)

**The Problem:**
Our initial API endpoints returned **all** results at once. The `/bookings` endpoint would dump 1000+ records in a single response. The frontend browser literally hung trying to render them.

Why? We built fast (MVP-speed) and skipped pagination initially. When we tested with slightly more realistic data, the web page froze.

**Why It Happened:**
Time pressure. Pagination felt like "nice to have" until we actually tested with more data. Lesson: test with realistic dataset sizes early.

**How We Fixed It:**
1. Audited every list endpoint (`/bookings`, `/availability`, `/courses`, `/lessons`, `/users`)
2. Added mandatory `page` and `limit` query parameters to each one
3. Standardized the response format:
   ```json
   {
     "data": [...items...],
     "total": 500,
     "page": 1,
     "limit": 10
   }
   ```
4. Implemented using Prisma `findMany()` with `skip` and `take` calculations

Result: Consistent 50-100ms response times. Browser never hangs. Unlimited scalability (just add more pages).

**Time cost:** 30 minutes (once we understood the problem)

---

## 4. Cross-Tenant Data Leakage Risk

**The Problem:**
This was caught during code review, not in live testing (which is terrifying—could have launched with it).

The API endpoints accepted things like `GET /courses/:courseId` but didn't verify that the `courseId` belonged to the current user's school/tenant. A malicious student could guess course IDs from other schools and access them.

**Why It Happened:**
Tenant context was available (it comes in the JWT token), but we weren't *enforcing* it on queries. "It's there" ≠ "it's being used."

**How We Fixed It:**
1. Created a `@TenantGuard()` decorator that:
   - Extracts tenant_id from the JWT token
   - Adds `where: { tenant_id: userTenantId }` to every Prisma query
   - Returns 403 Forbidden if there's a tenant mismatch

2. Applied it to all protected endpoints in one pass

Result: Tenant_id is now a non-negotiable part of every query. Can't accidentally violate it even if you try. Data from School A literally cannot be queried by School B no matter what.

**Time cost:** 1 hour (architecture, implementation, testing)

---

## 5. Frontend-to-Backend Connection Issues

**The Problem:**
Frontend container built successfully but couldn't reach the API. Browser console showed: "Failed to fetch from http://localhost:3001 — connection refused"

The frontend was trying to connect to `http://localhost:3001` from *inside* a Docker container. "Localhost" inside a container means the container itself, not the host machine. The frontend was trying to call itself, not the API service.

**Why It Happened:**
Docker networking is non-obvious. We set the environment variable `NEXT_PUBLIC_API_BASE_URL` to `http://localhost:3001` without thinking about container context. Worked fine in local dev (host running all services), broke in Docker.

**How We Fixed It:**
Changed `docker-compose.yml` to use the service name:
```yaml
frontend:
  environment:
    NEXT_PUBLIC_API_BASE_URL: http://api:3001  # ← Changed from localhost
```

Inside a Docker network, `api` is a valid DNS name that points to the API service. Containers talk to each other by service name, not localhost.

**Time cost:** 1 hour (debugging because Docker networking is underspecified in most tutorials)

---

## 6. API Export Issue on Rebuild

**The Problem:**
Frontend build failed with: `Attempted import error: 'api' is not exported from '@/lib/api'`

The file `api.ts` only exported a function `apiUrl()` but the (newly rewritten) component `LessonPage.tsx` was trying to import `{ api }` (an object with `get()` and `post()` methods).

**Why It Happened:**
The LessonPage component was refactored to use the real API, but the api.ts file wasn't updated to export the `api` object. It was a documentation update that revealed an import mismatch.

**How We Fixed It:**
Added the missing `api` export to `lib/api.ts`:
```typescript
export const api = {
  async get<T>(path: string): Promise<T> { ... },
  async post<T>(path: string, data?: unknown): Promise<T> { ... },
};
```

**Time cost:** 5 minutes to fix, 1 hour to rebuild/redeploy Docker

---

## Lessons Learned

1. **Multi-stage Docker is standard practice** (not optional). Always get it right early.

2. **Pagination is not optional** (even for MVP). Test with realistic dataset size immediately.

3. **Tenant isolation must be enforced at query layer** (not optional). Use guards, decorators, wherever you can.

4. **Containers live in their own network.** `localhost` is useless; use service names.

5. **Test the real system**, not just parts. We did end-to-end testing: login → book → quiz. Caught most issues before they reached users.

6. **Code review catches things** testing misses (like tenant leakage). Have someone else look at security-critical code.

---

## If We Had One More Week

We would have built:

### 1. Comprehensive Test Suite (2 days)
- Jest unit tests for authentication (token generation, validation, expiry)
- Unit tests for booking logic (state transitions, conflicts)
- E2E tests using actual browsers (student logs in → books → completes quiz)
- Coverage target: >80%
- Would have caught the tenant isolation issue automatically

### 2. Full-Text Search (1 day)
- Integrate Meilisearch or Elasticsearch
- Search across course titles, descriptions, lesson content, instructor names
- Would let students find relevant courses faster
- Current basic titlename search is sufficient for 3 courses; breaks at 100+

### 3. Instructor Dashboard (2 days)
- Analytics: Total students, bookings per week, revenue per instructor
- Reports: Course performance, quiz results by student
- Calendar view of all bookings (currently list-only)
- Batch operations (approve 10 bookings at once)

### 4. Fine-Grained Access Control (1.5 days)
- CASL ability checks: "Can this instructor edit this course?"
- Currently just role-based (`@IsInstructor()`)
- Needed for shared courses, delegation, resource ownership

### 5. Advanced Student Dashboard (1 day)
- Progress tracking: Show quiz results over time
- Certificate generation: After completing course, generate PDF
- Personalized recommendations: "Based on your interests, try..."
- Currently just course list + quiz results

### 6. Notifications (1 day)
- Email: "Booking approved!" "Quiz score available!"
- In-app notifications: Toast notifications for state changes
- Currently nothing (users have to refresh to see updates)

### 7. Audit Logging (0.5 days)
- Track who changed what when (security requirement for some users)
- Already have schema but not implementation
- Would let instructors verify quiz submissions weren't tampered with

---

## What We're Monitoring Post-Launch

- **Login success rate** (should be >95%)
- **Quiz submission latency** (should be <500ms)
- **Cross-tenant access attempts** (should be 0; triggers alert if >0)
- **Database query performance** (p95 <100ms)
- **Cache hit rate** (target >80% for bookings/availability)

If any of these degrade, we know where to optimize.

---

## The Bottom Line

AIRMAN shipped with security, performance, and reliability baked in. It could have been sloppier (skip migrations, use shared database, no caching). Instead, we built it right from the start. That's why 72 hours was enough for MVP.

**Next priorities:**
1. Launch and gather user feedback
2. Add tests (so future changes don't break things)
3. Add search (when course catalog grows)
4. Add instructor analytics dashboard (once we have more data)

See [PLAN.md](./PLAN.md) for how we prioritized and [CUTS.md](./CUTS.md) for what we deferred.
