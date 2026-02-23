import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as argon2 from 'argon2';

/**
 * Integration Tests — requires real Postgres + Redis (provided by CI service containers)
 * DATABASE_URL and REDIS_HOST must be set via environment variables
 */
describe('AIRMAN API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.use(cookieParser());
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanupTestData(prisma);
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────────────────────────────────────────
  describe('POST /auth/login', () => {
    it('should reject invalid credentials with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'wrong@wrong.com', password: 'bad' });

      expect(res.status).toBe(401);
    });

    it('should return accessToken for valid admin credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ci-admin@test.com', password: 'ci-pass-123' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      adminToken = res.body.accessToken;
    });

    it('should write an AuditLog entry on successful login', async () => {
      const log = await prisma.auditLog.findFirst({
        where: { action: 'POST', entity_type: 'Login' },
        orderBy: { created_at: 'desc' },
      });
      expect(log).not.toBeNull();
      expect(log?.user_id).toBeDefined();
      expect(log?.tenant_id).toBeDefined();
      expect(log?.correlation_id).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // COURSES
  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /courses', () => {
    it('should return paginated course list', async () => {
      const res = await request(app.getHttpServer())
        .get('/courses?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('limit', 5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // AUDIT LOGS
  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /audit-logs', () => {
    it('should return paginated audit logs for admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/audit-logs?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('correlation_id');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // USERS — pagination
  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /users', () => {
    it('should return paginated user list', async () => {
      const res = await request(app.getHttpServer())
        .get('/users?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // RATE LIMITING — auth endpoint
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Rate limiting on POST /auth/login', () => {
    it('should return 429 after 5 rapid failed attempts', async () => {
      const attempts = Array.from({ length: 6 }, () =>
        request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'x@x.com', password: 'wrong' }),
      );
      const results = await Promise.all(attempts);
      const statuses = results.map((r) => r.status);
      // At least one should be 429
      expect(statuses).toContain(429);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function seedTestData(prisma: PrismaService) {
  const tenant = await prisma.tenant.create({
    data: {
      name: 'CI Test School',
      tenant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    },
  });

  const adminRole = await prisma.role.create({
    data: { tenant_id: tenant.id, name: 'admin' },
  });

  const passwordHash = await argon2.hash('ci-pass-123');
  await prisma.user.create({
    data: {
      email: 'ci-admin@test.com',
      passwordHash,
      name: 'CI Admin',
      tenant_id: tenant.id,
      roleId: adminRole.id,
    },
  });
}

async function cleanupTestData(prisma: PrismaService) {
  await prisma.auditLog.deleteMany({ where: { tenant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: 'ci-admin@test.com' } }).catch(() => {});
  await prisma.role.deleteMany({ where: { name: 'admin', tenant_id: { startsWith: 'aaaaaaaa' } } }).catch(() => {});
  await prisma.tenant.deleteMany({ where: { tenant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' } }).catch(() => {});
}
