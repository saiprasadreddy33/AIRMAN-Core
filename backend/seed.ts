import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Database...');

  // Clean up
  await prisma.tenant.deleteMany();

  const tenantA = await prisma.tenant.create({ data: { tenant_id: '11111111-1111-1111-1111-111111111111', name: 'Flight School A' } });
  const tenantB = await prisma.tenant.create({ data: { tenant_id: '22222222-2222-2222-2222-222222222222', name: 'Flight School B' } });

  // Roles
  const rolesA = {
    admin: await prisma.role.create({ data: { tenant_id: tenantA.id, name: 'admin' } }),
    instructor: await prisma.role.create({ data: { tenant_id: tenantA.id, name: 'instructor' } }),
    student: await prisma.role.create({ data: { tenant_id: tenantA.id, name: 'student' } }),
  };
  const rolesB = {
    student: await prisma.role.create({ data: { tenant_id: tenantB.id, name: 'student' } }),
  };

  const passwordHash = await argon2.hash('password');

  // Users for Tenant A
  const studentA = await prisma.user.create({
    data: { tenant_id: tenantA.id, roleId: rolesA.student.id, email: 'studenta@test.com', passwordHash, name: 'Student A' }
  });
  const instructorA = await prisma.user.create({
    data: { tenant_id: tenantA.id, roleId: rolesA.instructor.id, email: 'instructora@test.com', passwordHash, name: 'Instructor A' }
  });
  const adminA = await prisma.user.create({
    data: { tenant_id: tenantA.id, roleId: rolesA.admin.id, email: 'admina@test.com', passwordHash, name: 'Admin A' }
  });

  // Users for Tenant B
  const studentB = await prisma.user.create({
    data: { tenant_id: tenantB.id, roleId: rolesB.student.id, email: 'studentb@test.com', passwordHash, name: 'Student B' }
  });

  // Learning Module Data for Tenant A
  const course = await prisma.course.create({
    data: { tenant_id: tenantA.id, title: 'Private Pilot 101', description: 'Intro course' }
  });

  const module = await prisma.learningModule.create({
    data: { tenant_id: tenantA.id, course_id: course.id, title: 'Aerodynamics' }
  });

  const lesson = await prisma.lesson.create({
    data: { tenant_id: tenantA.id, module_id: module.id, title: 'Lift & Drag', type: 'MCQ', content: 'Quiz time!' }
  });

  const q1 = await prisma.quizQuestion.create({
    data: {
      tenant_id: tenantA.id,
      lesson_id: lesson.id,
      question: 'What creates lift?',
      options: ['Airfoil shape', 'Magic', 'Engines only', 'Gravity'],
      correct_option: 0
    }
  });

  const q2 = await prisma.quizQuestion.create({
    data: {
      tenant_id: tenantA.id,
      lesson_id: lesson.id,
      question: 'What opposes thrust?',
      options: ['Lift', 'Drag', 'Weight', 'Speed'],
      correct_option: 1
    }
  });

  console.log('--- SEED REPORT ---');
  console.log('Tenant A ID:', tenantA.id);
  console.log('Tenant B ID:', tenantB.id);
  console.log('Student A Email:', studentA.email, '(password: "password")');
  console.log('Instructor A ID:', instructorA.id);
  console.log('Course ID:', course.id);
  console.log('Lesson ID:', lesson.id);
  console.log('Quiz Q1 ID:', q1.id);
  console.log('Quiz Q2 ID:', q2.id);
  console.log('Student B Email:', studentB.email, '(password: "password")');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
