import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Tenant Isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  let schoolAId: string;
  let schoolBId: string;
  let instructorSchoolA: string;
  let tokenSchoolA: string;
  let tokenSchoolB: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);

    // Create 2 discrete schools
    const schoolA = await prisma.tenant.create({ data: { tenant_id: '11111111-1111-1111-1111-111111111111', name: 'School A' } });
    const schoolB = await prisma.tenant.create({ data: { tenant_id: '22222222-2222-2222-2222-222222222222', name: 'School B' } });
    schoolAId = schoolA.id;
    schoolBId = schoolB.id;

    // Create required Roles
    const roleAdminA = await prisma.role.create({ data: { tenant_id: schoolAId, name: 'admin' } });
    const roleInstA = await prisma.role.create({ data: { tenant_id: schoolAId, name: 'instructor' } });
    const roleAdminB = await prisma.role.create({ data: { tenant_id: schoolBId, name: 'admin' } });

    // Create a User in School A and issue token
    const userA = await prisma.user.create({
      data: { tenant_id: schoolAId, email: 'a@schoola.com', passwordHash: 'hash', roleId: roleAdminA.id, name: 'Admin A' },
    });
    tokenSchoolA = await jwt.signAsync(
      { sub: userA.id, email: userA.email, role: 'admin', tenant_id: schoolAId },
      { secret: process.env.JWT_PUBLIC_KEY || 'fake-secret' }
    );

    // Create an Instructor specifically bound to School A
    const instrA = await prisma.user.create({
      data: { tenant_id: schoolAId, email: 'inst@schoola.com', passwordHash: 'hash', roleId: roleInstA.id, name: 'Instructor A' },
    });
    instructorSchoolA = instrA.id;

    // Populate data strictly in School A
    await prisma.instructorAvailability.create({
      data: { tenant_id: schoolAId, instructor_id: instructorSchoolA, start_time: new Date(), end_time: new Date() },
    });
    await prisma.course.create({
      data: { tenant_id: schoolAId, title: 'Flight 101', description: 'Intro to Flight' }
    });

    // Create a User in School B and issue token
    const userB = await prisma.user.create({
      data: { tenant_id: schoolBId, email: 'b@schoolb.com', passwordHash: 'hash', roleId: roleAdminB.id, name: 'Admin B' },
    });
    tokenSchoolB = await jwt.signAsync(
      { sub: userB.id, email: userB.email, role: 'admin', tenant_id: schoolBId },
      { secret: process.env.JWT_PUBLIC_KEY || 'fake-secret' }
    );
  });

  afterAll(async () => {
    // Cleanup generated e2e tenants securely cascading their payload deletions natively
    await prisma.tenant.deleteMany({ where: { id: { in: [schoolAId, schoolBId] } } });
    await app.close();
  });

  it('School A retrieves School A availability', async () => {
    const response = await request(app.getHttpServer())
      .get('/availability')
      .set('Authorization', `Bearer ${tokenSchoolA}`)
      .expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0].tenant_id).toBe(schoolAId);
  });

  it('School B receives empty isolation walls when trying to query availability natively belonging to School A', async () => {
    const response = await request(app.getHttpServer())
      .get('/availability')
      .set('Authorization', `Bearer ${tokenSchoolB}`)
      .expect(200);

    expect(response.body.data.length).toBe(0);
  });

  it('School B gets 400 Bad Request if creating a Booking referencing School A instructor (Foreign Key strictly bounded by tenant mismatch)', async () => {
    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${tokenSchoolB}`)
      .send({
        instructor_id: instructorSchoolA,
        student_id: instructorSchoolA,
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
      })
      .expect(400); // Because bounded Prisma constraints will reject foreign associations crossing schemas/tenants implicitly
  });
});
