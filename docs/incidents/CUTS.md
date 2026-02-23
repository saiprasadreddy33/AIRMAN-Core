# What We Didn't Build (And Why)

We could have built these 4 features for MVP. We didn't. Here's why each decision was right.

---

## 1. Full Automated Test Coverage (Jest Unit + E2E Tests)

**What would it be:**
- Jest unit tests for every function (auth, bookings, courses, etc.)
- E2E tests that simulate real users (login → book → quiz)
- Browser-based testing with Selenium or Playwright
- **Goal:** >80% code coverage

**Why we cut it:**
- **Time cost:** Tests add 30-40% overhead to development. For every feature, you write tests equal to the feature code.
- **MVP value:** We manually tested everything (logged in, booked, took quizzes, checked database). It works. Tests would slow us down more than they'd help.
- **Real risk:** At MVP, shipping on time matters more than code coverage metrics.

**When we'll do it:**
- After launch, once we have real users depending on it
- Before scaling to multiple instructors or schools (tests will catch concurrency bugs)
- Timeline: Next 1-2 weeks

**What could go wrong without it:**
- A future change breaks login (tests would catch it automatically)
- Someone accidentally reintroduces the tenant leakage bug (automated tests would fail immediately)
- Quiz grading changes break booking logic (no tests = manual regression testing)

---

## 2. Full-Text Search Engine (Elasticsearch / Meilisearch)

**What would it be:**
- Search across course titles, descriptions, lesson content, instructor names
- Fast querying of large datasets (currently 3 courses; what about 1000?)
- Autocomplete suggestions ("Aircraft typo" suggests "Aircraft Maneuvers")

**Why we cut it:**
- **Scale doesn't justify it:** Postgres native `ILIKE` (case-insensitive substring search) is instant on 3-10 courses. Elasticsearch adds operational complexity for zero user benefit.
- **Operational burden:** Another service to manage, monitor, tune. Another failure point.
- **Time cost:** 1-2 days for setup + integration + testing.
- **MVP clarity:** Users don't complain about search; they complain about bookings not working. Priorities.

**When we'll do it:**
- When dataset grows beyond Postgres comfort zone (50+ courses across 10+ schools)
- When users explicitly request "I can't find that course"
- Timeline: Month 3 of launch, if needed

**What could go wrong without it:**
- Instructors can still use browser's Ctrl+F to search courses (suboptimal but works)
- Students with typos might miss relevant courses (they'll ask instructors instead)
- Database query gets slower as courses grow (but not before 100+ courses)

---

## 3. Fine-Grained Access Control (CASL)

**What would it be:**
- Ability-based permissions: "Can Alice edit this course?" vs just "Is Alice an instructor?"
- Resource-level checks: "Does Bob own this booking?"
- Shared resources: "Can I see courses shared with me?"

**Why we cut it:**
- **MVP isn't collaborative:** Each instructor owns their courses. No sharing. No delegation.
- **Role guards are enough:** `@IsInstructor()` decorator prevents students accessing instructor routes. `@IsStudent()` prevents instructors accessing student routes. Works.
- **Added complexity:** CASL adds permission checks to 20+ endpoints. Code gets harder to read. Bugs harder to find.
- **Time cost:** 1.5 days for implementation + testing.

**When we'll do it:**
- When instructors request: "I want to collaborate with another instructor on this course"
- When admins request: "I need to delegate lesson approval to another instructor"
- Timeline: Month 2, if user demand emerges

**What could go wrong without it:**
- Instructor A could (in theory) modify Instructor B's course (but they're in different tenants, so no)
- Students could (in theory) approve their own bookings (but the API enforces role, so no)
- Admin functionality is limited (admins can only see their own school's data)

**Current safety:** Tenant isolation + role-based guards = sufficient for MVP. No data leaks. No unauthorized actions.

---

## 4. Advanced Cache Invalidation (Redis SCAN with Cursors)

**What would it be:**
- Instead of `client.keys('pattern')` (blocks Redis), use `client.scan()` with cursors
- Doesn't block Redis I/O; iterates in chunks
- Scales to millions of keys without freezing the database

**Why we cut it:**
- **MVP doesn't have millions of keys:** We're caching bookings and availability for one or two schools. Maybe 1000 keys total.
- **Current approach is instant:** `KEYS` pattern matching on 1000 keys takes <5ms. Zero user impact.
- **Premature optimization:** "Make it work, make it right, make it fast." We're at "make it work" stage.
- **Time cost:** 2 hours for implementation, but testing cursor logic is fiddly.

**When we'll do it:**
- When Redis monitoring shows cache invalidation taking >10ms (hasn't happened)
- When we scale to 100+ concurrent users per school
- Timeline: Never, probably. Unless data grows unexpectedly.

**What could go wrong without it:**
- Cache invalidation takes 10ms instead of 5ms (user won't notice)
- At massive scale (which we don't have), Redis could briefly lock (mitigation: add more Redis instances)

---

## Summary: Why These Trade-Offs Were Right

**We prioritized:**
1. Shipping a working product on time
2. Data security (tenant isolation, authentication)
3. Reasonable performance (caching, pagination)

**We sacrificed:**
1. Test coverage (manual testing was enough)
2. Advanced search (Postgres search is fine)
3. Granular permissions (roles work today)
4. Scaling optimizations (we're not at scale yet)

**If this were production code for a fortune 500 company?** Different call. Tests matter. Security audits matter. Compliance matters.

**For a 72-hour MVP where users don't exist yet?** Shipping > perfection. Tests are debt we'll pay next week if users actually show up.

---

## Roadmap (What's Next)

**Week 2:**
- Jest test suite for critical paths (auth, bookings, quizzes)
- Bug fixes from launch feedback
- Performance monitoring setup

**Week 3-4:**
- Fine-grained access control (if instructors request collaboration)
- Instructor dashboard (analytics on student progress)
- Email notifications (bookings, quiz results)

**Month 2:**
- Full-text search (if catalog grows past 30 courses)
- Student progress reports
- Course recommendations

**Month 3+:**
- Scaling optimizations (Redis SCAN, connection pooling)
- Advanced features (video integration, whiteboard, screen sharing)

See [PLAN.md](./PLAN.md) for what shipped in 72 hours and [POSTMORTEM.md](./POSTMORTEM.md) for what broke along the way.
