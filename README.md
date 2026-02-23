# AIRMAN-Core

AIRMAN—a multi-tenant flight instruction booking and learning platform built in 72 hours. This is a complete instructor booking system combined with an interactive online learning module where students can take quizzes and track progress across courses.


## Technical Stack

| Component | What We Use |
|-----------|-------------|
| **Backend** | NestJS with TypeScript (type-safe, scales well) |
| **Database** | PostgreSQL for reliability + Prisma ORM (migrations that don't break) |
| **Passwords** | Argon2 hashing (industry standard, slow by design) |
| **Caching** | Redis (instant availability lookups, 300s refresh) |
| **Jobs** | BullMQ (send emails/reports without blocking requests) |
| **Containers** | Docker Compose (dev and prod look identical) |
| **Safety** | Rate limiting (stops brute-force attacks) |

## Getting Started (5 minutes)

### What You Need
- Docker & Docker Compose (everything else runs inside containers)
- Git
- A terminal

### Step 1: Clone It
```bash
git clone <repository-url>
cd AIRMAN-Core
```

### Step 2: Start Everything
```bash
docker compose up --build -d
```

What happens behind the scenes:
- Postgres creates the database and runs migrations automatically
- Redis starts caching layer
- NestJS API initializes and seeds demo data
- Next.js frontend builds and starts serving
- BullMQ worker waits for background jobs

### Step 3: Wait ~30 seconds, Then Check
```bash
# Verify all services are running
docker compose ps

# Watch the API come online
docker compose logs api | grep "API running"
```

### Step 4: Log In
Open http://localhost:3000 in your browser and log in with any of these test accounts:

```
Student:
  Email: studenta@test.com
  Password: password

Instructor:
  Email: instructora@test.com
  Password: password

Admin:
  Email: admina@test.com
  Password: password
```

**Note:** Instructors see bookings and availability. Students see courses and can take quizzes.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Browser (User)                       │
│              http://localhost:3000 (Next.js)                │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ HTTPS/JSON
                 ▼
┌─────────────────────────────────────────────────────────────┐
│           NestJS API (http://localhost:3001)                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Auth Module   │ Courses │ Lessons │ Bookings │ Users  │ │
│  └────────────────────────────────────────────────────────┘ │
│                 ▲                    ▲                       │
│  ┌──────────────┴────────────────┬───┴─────────────┐        │
│  │ JWT Token   │ Rate Limiter   │ Tenant Guard   │        │
│  └──────────────┬────────────────┴─────────────────┘        │
└────────┬─────────────────────────────────┬──────────────────┘
         │                                 │
    Query Results                  Cache Misses
         │                                 │
         ▼                                 ▼
┌──────────────────┐         ┌──────────────────────┐
│    PostgreSQL    │         │   Redis Cache        │
│   (Database)     │         │ (Fast Lookups)       │
│ - Tenants        │         │ - Bookings (300s)    │
│ - Courses        │         │ - Availability (300s)│
│ - Lessons        │         │ - Session Tokens     │
│ - Quiz Attempts  │         │                      │
└──────────────────┘         └──────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│          Background Job Processor (BullMQ Worker)            │
│  ├─ Send quiz notifications                                  │
│  ├─ Generate reports                                         │
│  └─ Cleanup expired tokens                                   │
└──────────────────────────────────────────────────────────────┘
```

**How Data Flows:**
1. User logs in → Frontend sends email/password to `/auth/login`
2. API validates credentials, checks Redis cache first, then database
3. API returns JWT token (valid 1 hour)
4. Every request includes token in `Authorization: Bearer <token>` header
5. API verifies tenant ID to prevent cross-school data access
6. Response is cached in Redis if it's a read-heavy endpoint (courses, availability)
7. Background jobs handle non-urgent work (emails, reports)

## Core Features (What Actually Works)

### 🔐 Authentication & Security
- **Login:** JWT tokens that expire in 1 hour (no sessions to track)
- **Passwords:** Hashed with Argon2 (takes deliberately long to guess)
- **Rate Limiting:** 5 login attempts per minute per IP (stops brute force)
- **Tenant Isolation:** Every query checks tenant ID—data can't leak between schools
- **Three Roles:** Admin (manage school), Instructor (create content), Student (consume)
- **Permissions:** Enforced at backend API level + frontend route guards

### 📚 Learning Management (The Maverick Module)
- **Courses:** Instructors create courses (e.g., "Private Pilot 101")
- **Modules:** Each course has modules (e.g., "Aerodynamics Basics")
- **Lessons:** Each module has lessons—either reading or MCQ quiz
- **Reading Lessons:** Display course material with markdown support
- **Quiz Lessons:** MCQ questions where students select answers
- **Secure Grading:** Server validates answers (client never sees correct answers—prevents cheating)
- **Progress:** See student quiz scores and completion status

### 📅 Instructor Availability & Bookings
- **Set Hours:** Instructors tell us when they're available
- **Smart Caching:** We cache availability for 5 minutes (doesn't change often)
- **Students Book:** Students pick a time; instructor gets notification
- **Workflow:** Pending → Approved → Assigned → Completed
- **Calendar:** Everything shows up in a calendar view

### ⚡ Performance (Why It's Fast)
- **Pagination:** All lists return max 10 items per page (not 1000 dumped at once)
- **Caching:** Repeated requests hit Redis in <5ms instead of database in 50ms
- **Compression:** Responses gzipped automatically
- **Background Jobs:** Heavy work (reports, emails) doesn't block your request

## API Reference

### Authentication

**Login**
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "instructora@test.com",
    "password": "password"
  }'
```

**Response** (200 OK):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

**Use the token in future requests:**
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  http://localhost:3001/courses
```

---

### Courses

**List Courses** (paginated)
```bash
curl "http://localhost:3001/courses?page=1&limit=10" \
  -H "Authorization: Bearer <your_token>"
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "clz1a2b3c4d5e6f7g8h9i0j1",
      "title": "Private Pilot 101",
      "description": "Get your private pilot license",
      "instructor_id": "clz1a2b3c4d5e6f7g8h9i0j2",
      "tenant_id": "clz1a2b3c4d5e6f7g8h9i0j3",
      "created_at": "2026-02-23T15:30:00Z"
    }
  ],
  "total": 3,
  "page": 1,
  "limit": 10
}
```

**Get Course Details**
```bash
curl "http://localhost:3001/courses/clz1a2b3c4d5e6f7g8h9i0j1/modules" \
  -H "Authorization: Bearer <your_token>"
```

---

### Lessons & Quizzes

**Get a Lesson** (with questions if it's a quiz)
```bash
curl "http://localhost:3001/lessons/clz1a2b3c4d5e6f7g8h9i0j1" \
  -H "Authorization: Bearer <your_token>"
```

**Response** (200 OK - Reading Lesson):
```json
{
  "id": "clz1a2b3c4d5e6f7g8h9i0j1",
  "title": "Lift and Drag",
  "type": "TEXT",
  "content": "# Understanding Aerodynamics\n\n## Lift\nLift occurs when...",
  "module_id": "clz1a2b3c4d5e6f7g8h9i0j2",
  "created_at": "2026-02-23T15:30:00Z"
}
```

**Response** (200 OK - Quiz Lesson):
```json
{
  "id": "clz1a2b3c4d5e6f7g8h9i0j1",
  "title": "Aerodynamics Quiz",
  "type": "MCQ",
  "module_id": "clz1a2b3c4d5e6f7g8h9i0j2",
  "questions": [
    {
      "id": "q1",
      "question": "What causes lift?",
      "options": [
        "Bernoulli's principle and Newton's third law",
        "Only gravity",
        "Engine thrust alone",
        "Speed and altitude"
      ]
    },
    {
      "id": "q2",
      "question": "Drag increases with what?",
      "options": [
        "Speed squared",
        "Altitude only",
        "Weight only",
        "Engine power"
      ]
    }
  ]
}
```

**Submit Quiz Answers** (Student takes the test)
```bash
curl -X POST "http://localhost:3001/lessons/clz1a2b3c4d5e6f7g8h9i0j1/attempt" \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      { "questionId": "q1", "answer": 0 },
      { "questionId": "q2", "answer": 0 }
    ]
  }'
```

**Response** (200 OK - Quiz Graded):
```json
{
  "attemptId": "clz1a2b3c4d5e6f7g8h9i0j1",
  "score": 2,
  "total": 2,
  "incorrectQuestions": []
}
```

If they got one wrong:
```json
{
  "attemptId": "clz1a2b3c4d5e6f7g8h9i0j1",
  "score": 1,
  "total": 2,
  "incorrectQuestions": [
    {
      "questionId": "q2",
      "correctAnswer": 0
    }
  ]
}
```

---

### Offline-First Quiz Attempts ✨

AIRMAN supports **offline quiz taking**—students can take quizzes anywhere, even without internet, and sync results automatically when they reconnect. This is perfect for flight schools where training happens in remote locations.

#### How It Works

1. **Automatic Caching:** When a student opens a quiz, it's cached locally in their browser (IndexedDB)
2. **Works Offline:** Answers save locally as they type—no connection needed
3. **Auto-Sync:** When internet is restored, attempts upload automatically in background
4. **Smart Deduplication:** Handles network retries—same attempt won't be graded twice

#### User Experience

**Online (Normal):**
- Open quiz → Answer → Submit → Instant grading
- Zero latency, exactly like before

**Offline:**
- Open quiz → Answers saved locally
- Submit → Shows "Saved Locally" confirmation
- Get signal → Auto-syncs in background
- See "Synced ✓" once complete

**Indicator Badges:**
- 🟢 **Online** - Connected to internet
- 🔴 **Offline** - No connection, but quizzes still work
- 🔄 **Sync (N)** - Pending attempts queued for upload

#### API Endpoints

**Sync Offline Attempts** (Called automatically when connection restored)
```bash
curl -X POST "http://localhost:3001/lessons/sync-attempt" \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "lessonId": "clz1a2b3c4d5e6f7g8h9i0j1",
    "clientId": "attempt_1708702000000_a1b2c3d4e",
    "answers": [
      { "questionId": "q1", "answer": 0 },
      { "questionId": "q2", "answer": 1 }
    ]
  }'
```

**Response** (200 OK):
```json
{
  "attemptId": "clz1a2b3c4d5e6f7g8h9i0j1",
  "score": 2,
  "total": 2,
  "incorrectQuestions": [],
  "duplicateSync": false
}
```

#### How to Test Offline Mode

1. **Open Quiz Online:**
   ```
   Login → Courses → Select Course → Open Lesson → Start Quiz
   ```

2. **Go Offline** (Browser DevTools):
   - F12 → Network tab → Check "Offline"
   - Or disconnect WiFi

3. **Take Quiz Offline:**
   - Answer questions (all saved locally)
   - Submit → "Saved Locally" message
   - Close browser (data persists)

4. **Come Back Online:**
   - Disable offline mode / Reconnect WiFi
   - Return to courses page
   - Notice 🔄 **Sync** badge appears
   - Click it or wait 5 seconds for auto-sync
   - See ✅ **Synced** once complete
   - View grading with incorrect answers

#### Tech Details

- **Storage:** IndexedDB (can hold 50-100 cached quizzes)
- **Auto-Cleanup:** Synced attempts removed after 30 days
- **Smart Retry:** Failed syncs retry automatically every 10 seconds
- **No Libraries:** Uses native browser APIs (zero npm dependencies)

#### Perfect For:

- ✈️ In-flight training (airplane wifi is spotty)
- 🏔️ Remote flight training locations
- 🚁 Helicopter rescue training in mountains
- 📡 Any environment with unreliable connectivity

---

**Get Available Time Slots** (what times is this instructor free?)
```bash
curl "http://localhost:3001/availability/instructor/clz1a2b3c4d5e6f7g8h9i0j1?page=1&limit=20" \
  -H "Authorization: Bearer <your_token>"
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "clz1a2b3c4d5e6f7g8h9i0j1",
      "instructor_id": "clz1a2b3c4d5e6f7g8h9i0j2",
      "start_time": "2026-02-24T10:00:00Z",
      "end_time": "2026-02-24T11:00:00Z",
      "status": "AVAILABLE"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 20
}
```

**Book a Session** (Student requests a lesson)
```bash
curl -X POST "http://localhost:3001/bookings" \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "instructor_id": "clz1a2b3c4d5e6f7g8h9i0j2",
    "start_time": "2026-02-24T10:00:00Z",
    "end_time": "2026-02-24T11:00:00Z"
  }'
```

**Response** (201 Created):
```json
{
  "id": "clz1a2b3c4d5e6f7g8h9i0j1",
  "student_id": "clz1a2b3c4d5e6f7g8h9i0j3",
  "instructor_id": "clz1a2b3c4d5e6f7g8h9i0j2",
  "start_time": "2026-02-24T10:00:00Z",
  "end_time": "2026-02-24T11:00:00Z",
  "status": "PENDING",
  "created_at": "2026-02-23T15:30:00Z"
}
```

**Instructor Approves Booking**
```bash
curl -X PATCH "http://localhost:3001/bookings/clz1a2b3c4d5e6f7g8h9i0j1/approve" \
  -H "Authorization: Bearer <your_token>"
```

**Response** (200 OK):
```json
{
  "id": "clz1a2b3c4d5e6f7g8h9i0j1",
  "status": "APPROVED",
  "updated_at": "2026-02-23T15:35:00Z"
}
```

---

### Users

**Get Current User Profile**
```bash
curl "http://localhost:3001/users/me" \
  -H "Authorization: Bearer <your_token>"
```

**Response** (200 OK):
```json
{
  "id": "clz1a2b3c4d5e6f7g8h9i0j1",
  "email": "instructora@test.com",
  "name": "Alice Smith",
  "role": "INSTRUCTOR",
  "tenant_id": "clz1a2b3c4d5e6f7g8h9i0j3"
}
```

---

### Error Responses

**Invalid Token** (401 Unauthorized):
```json
{ "statusCode": 401, "message": "Invalid token" }
```

**Rate Limited** (429 Too Many Requests):
```json
{ "statusCode": 429, "message": "Too many login attempts. Try again in 60 seconds." }
```

---

### Error Responses

**Invalid Token** (401 Unauthorized):
```json
{ "statusCode": 401, "message": "Invalid token" }
```

**Rate Limited** (429 Too Many Requests):
```json
{ "statusCode": 429, "message": "Too many login attempts. Try again in 60 seconds." }
```

**Cross-Tenant Access** (403 Forbidden):
```json
{ "statusCode": 403, "message": "You do not have access to this resource" }
```

## Project Structure

```
airman-core/
├── backend/                 # NestJS API
│   ├── src/
│   │   ├── auth/           # JWT + authentication
│   │   ├── learning/       # Courses, lessons, assessments
│   │   ├── scheduling/     # Bookings, availability
│   │   ├── tenants/        # Multi-tenancy guards
│   │   └── common/         # Shared decorators, guards, interceptors
│   ├── prisma/             # Database schema & migrations
│   └── Dockerfile          # Multi-stage build
├── frontend/                # Next.js UI
├── docker-compose.yml       # Orchestration
└── README.md               # This file
```

## 📚 Documentation

Complete documentation is organized in the [`/docs` directory](./docs/):

- **[Getting Started](./docs/setup/)** - Environment setup and GitHub configuration
- **[Architecture](./docs/architecture/)** - System design, authentication, and interconnections
- **[Deployment](./docs/deployment/)** - Production deployment and rollback procedures
- **[Features](./docs/features/)** - Detailed feature implementations (e.g., offline quizzes)
- **[Security](./docs/security/)** - Secrets management and compliance
- **[Incidents](./docs/incidents/)** - Post-mortems and intentional cuts

👉 **New here?** Start with [docs/README.md](./docs/README.md) for a complete guide.

## Key Technical Decisions & Why

### Data Isolation Over Shared Databases
Every query filters by `tenant_id`. Yes, it adds a WHERE clause to every query, but it means we'll never accidentally leak School A's data to School B. The safety is worth the small performance cost. See [System Architecture Plan](./docs/architecture/PLAN.md) for the 72-hour breakdown.

### Redis for Caching (Not Full Persistence)
We cache reads (courses, availability) for 5 minutes. We don't cache writes. If an instructor updates availability, it clears cache immediately. Simple >> complex consistency guarantees.

### Server-Side Quiz Grading (Not Client-Side)
Quiz questions are sent to the browser without correct answers. Students answer in browser, then we ship just their selections to the server. We grade server-side. This means no JavaScript tricks can peek at answers before submission.

### Monorepo (Backend + Frontend + Compose)
One repo, one `docker-compose up`. DevOps is free; git clone literally works for new people. The tradeoff: separate repositories would let teams move independently (not relevant at 2 people).

## What We Didn't Build (And Why)

See [Cuts & Intentional Skips](./docs/incidents/CUTS.md) for an honest look at 4 features we intentionally skipped:
- Full test coverage (time, not hard)
- Full-text search (unnecessary at MVP scale)
- Fine-grained access control (roles work fine for now)
- Advanced cache invalidation (simple works fine)

## Security & Authentication Documentation

See [Authentication & RBAC](./docs/architecture/AUTH-RBAC.md) for complete verification of:
- ✅ Three roles (Admin, Instructor, Student) with enforced permissions
- ✅ Argon2 password hashing (industry standard)
- ✅ JWT + Refresh tokens (15-min access, 30-day refresh)
- ✅ Backend RBAC on all protected routes
- ✅ Frontend middleware + component route guards
- ✅ Multi-tenant data isolation on every query
- ✅ Rate limiting (brute-force protection)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Module not found: argon2` | Rebuild containers: `docker-compose down && docker-compose up --build` |
| Database migration failures | Check Docker network: `docker-compose logs api` |
| Stale cache data | Manually flush Redis: `docker-compose exec redis redis-cli FLUSHALL` |
| Port already in use | Update `docker-compose.yml` port mappings or stop conflicting services |

## Contributing

When adding new features:
1. Ensure tenant isolation: all queries must filter by `tenant_id`
2. Add pagination to list endpoints: use `page` and `limit` query parameters
3. Cache high-frequency responses: target < 100ms p50 latency
4. Document deferred work in CUTS.md when cutting MVP scope
