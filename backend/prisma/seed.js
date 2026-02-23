const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

async function main() {
  const tenantAId = '11111111-1111-1111-1111-111111111111';
  const tenantBId = '22222222-2222-2222-2222-222222222222';

  const tenantA = await prisma.tenant.upsert({
    where: { tenant_id: tenantAId },
    create: {
      id: tenantAId,
      tenant_id: tenantAId,
      name: 'Flight School A',
    },
    update: { name: 'Flight School A' },
  });

  const tenantB = await prisma.tenant.upsert({
    where: { tenant_id: tenantBId },
    create: {
      id: tenantBId,
      tenant_id: tenantBId,
      name: 'Flight School B',
    },
    update: { name: 'Flight School B' },
  });

  const [adminRoleA, instructorRoleA, studentRoleA, studentRoleB] = await Promise.all([
    prisma.role.upsert({
      where: { tenant_id_name: { tenant_id: tenantA.id, name: 'admin' } },
      create: { tenant_id: tenantA.id, name: 'admin' },
      update: {},
    }),
    prisma.role.upsert({
      where: { tenant_id_name: { tenant_id: tenantA.id, name: 'instructor' } },
      create: { tenant_id: tenantA.id, name: 'instructor' },
      update: {},
    }),
    prisma.role.upsert({
      where: { tenant_id_name: { tenant_id: tenantA.id, name: 'student' } },
      create: { tenant_id: tenantA.id, name: 'student' },
      update: {},
    }),
    prisma.role.upsert({
      where: { tenant_id_name: { tenant_id: tenantB.id, name: 'student' } },
      create: { tenant_id: tenantB.id, name: 'student' },
      update: {},
    }),
  ]);

  const demoPasswordHash = await argon2.hash('password');

  const [studentA, instructorA] = await Promise.all([
    prisma.user.upsert({
      where: { tenant_id_email: { tenant_id: tenantA.id, email: 'studenta@test.com' } },
      create: {
        tenant_id: tenantA.id,
        roleId: studentRoleA.id,
        email: 'studenta@test.com',
        passwordHash: demoPasswordHash,
        name: 'Student A',
      },
      update: {
        passwordHash: demoPasswordHash,
        roleId: studentRoleA.id,
        name: 'Student A',
      },
    }),
    prisma.user.upsert({
      where: { tenant_id_email: { tenant_id: tenantA.id, email: 'instructora@test.com' } },
      create: {
        tenant_id: tenantA.id,
        roleId: instructorRoleA.id,
        email: 'instructora@test.com',
        passwordHash: demoPasswordHash,
        name: 'Instructor A',
      },
      update: {
        passwordHash: demoPasswordHash,
        roleId: instructorRoleA.id,
        name: 'Instructor A',
      },
    }),
  ]);

  await Promise.all([
    prisma.user.upsert({
      where: { tenant_id_email: { tenant_id: tenantA.id, email: 'admina@test.com' } },
      create: {
        tenant_id: tenantA.id,
        roleId: adminRoleA.id,
        email: 'admina@test.com',
        passwordHash: demoPasswordHash,
        name: 'Admin A',
      },
      update: {
        passwordHash: demoPasswordHash,
        roleId: adminRoleA.id,
        name: 'Admin A',
      },
    }),
    prisma.user.upsert({
      where: { tenant_id_email: { tenant_id: tenantB.id, email: 'studentb@test.com' } },
      create: {
        tenant_id: tenantB.id,
        roleId: studentRoleB.id,
        email: 'studentb@test.com',
        passwordHash: demoPasswordHash,
        name: 'Student B',
      },
      update: {
        passwordHash: demoPasswordHash,
        roleId: studentRoleB.id,
        name: 'Student B',
      },
    }),
  ]);

  let course = await prisma.course.findFirst({
    where: { tenant_id: tenantA.id, title: 'Private Pilot 101' },
  });

  if (!course) {
    course = await prisma.course.create({
      data: {
        tenant_id: tenantA.id,
        title: 'Private Pilot 101',
        description: 'Foundational pilot training covering safety, aerodynamics, and navigation.',
      },
    });
  }

  let module = await prisma.learningModule.findFirst({
    where: { tenant_id: tenantA.id, course_id: course.id, title: 'Aerodynamics Basics' },
  });

  if (!module) {
    module = await prisma.learningModule.create({
      data: {
        tenant_id: tenantA.id,
        course_id: course.id,
        title: 'Aerodynamics Basics',
      },
    });
  }

  let lesson = await prisma.lesson.findFirst({
    where: { tenant_id: tenantA.id, module_id: module.id, title: 'Lift, Drag, and Stability Quiz' },
  });

  if (!lesson) {
    lesson = await prisma.lesson.create({
      data: {
        tenant_id: tenantA.id,
        module_id: module.id,
        title: 'Lift, Drag, and Stability Quiz',
        type: 'MCQ',
        content: 'Answer these questions to validate your understanding of flight fundamentals.',
      },
    });
  }

  const existingQuestionCount = await prisma.quizQuestion.count({
    where: { tenant_id: tenantA.id, lesson_id: lesson.id },
  });

  if (existingQuestionCount === 0) {
    await prisma.quizQuestion.createMany({
      data: [
        {
          tenant_id: tenantA.id,
          lesson_id: lesson.id,
          question: 'Which force directly opposes thrust?',
          options: ['Lift', 'Weight', 'Drag', 'Torque'],
          correct_option: 2,
        },
        {
          tenant_id: tenantA.id,
          lesson_id: lesson.id,
          question: 'Increasing wing angle of attack (before stall) generally increases?',
          options: ['Lift', 'Fuel burn only', 'Landing gear drag only', 'Cabin pressure'],
          correct_option: 0,
        },
      ],
    });
  }

  const now = new Date();
  const approvedStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const approvedEnd = new Date(approvedStart.getTime() + 60 * 60 * 1000);

  const assignedStart = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const assignedEnd = new Date(assignedStart.getTime() + 60 * 60 * 1000);

  const approvedBooking = await prisma.booking.findFirst({
    where: {
      tenant_id: tenantA.id,
      instructor_id: instructorA.id,
      student_id: studentA.id,
      start_time: approvedStart,
    },
  });

  if (!approvedBooking) {
    await prisma.booking.create({
      data: {
        tenant_id: tenantA.id,
        instructor_id: instructorA.id,
        student_id: studentA.id,
        start_time: approvedStart,
        end_time: approvedEnd,
        status: 'approved',
        requested_at: new Date(approvedStart.getTime() - 2 * 60 * 60 * 1000),
        approved_at: new Date(approvedStart.getTime() - 60 * 60 * 1000),
      },
    });
  }

  const assignedBooking = await prisma.booking.findFirst({
    where: {
      tenant_id: tenantA.id,
      instructor_id: instructorA.id,
      student_id: studentA.id,
      start_time: assignedStart,
    },
  });

  if (!assignedBooking) {
    await prisma.booking.create({
      data: {
        tenant_id: tenantA.id,
        instructor_id: instructorA.id,
        student_id: studentA.id,
        start_time: assignedStart,
        end_time: assignedEnd,
        status: 'assigned',
        requested_at: new Date(assignedStart.getTime() - 3 * 60 * 60 * 1000),
        approved_at: new Date(assignedStart.getTime() - 2 * 60 * 60 * 1000),
        assigned_at: new Date(assignedStart.getTime() - 60 * 60 * 1000),
      },
    });
  }

  // === Example Course 2: Advanced Navigation ===
  let course2 = await prisma.course.findFirst({
    where: { tenant_id: tenantA.id, title: 'Advanced Navigation & Instrument Flying' },
  });

  if (!course2) {
    course2 = await prisma.course.create({
      data: {
        tenant_id: tenantA.id,
        title: 'Advanced Navigation & Instrument Flying',
        description: 'Master cross-country navigation, instrument approaches, and modern avionics systems for commercial operations.',
      },
    });
  }

  let module2a = await prisma.learningModule.findFirst({
    where: { tenant_id: tenantA.id, course_id: course2.id, title: 'GPS and Modern Avionics' },
  });

  if (!module2a) {
    module2a = await prisma.learningModule.create({
      data: {
        tenant_id: tenantA.id,
        course_id: course2.id,
        title: 'GPS and Modern Avionics',
      },
    });
  }

  let lesson2a = await prisma.lesson.findFirst({
    where: { tenant_id: tenantA.id, module_id: module2a.id, title: 'GPS Systems Overview' },
  });

  if (!lesson2a) {
    lesson2a = await prisma.lesson.create({
      data: {
        tenant_id: tenantA.id,
        module_id: module2a.id,
        title: 'GPS Systems Overview',
        type: 'TEXT',
        content: 'Global Positioning System (GPS) has revolutionized aircraft navigation. GPS provides accurate position, altitude, and velocity data. Modern glass cockpits integrate GPS for real-time flight planning and route optimization.',
      },
    });
  }

  let lesson2b = await prisma.lesson.findFirst({
    where: { tenant_id: tenantA.id, module_id: module2a.id, title: 'Avionics Integration Quiz' },
  });

  if (!lesson2b) {
    lesson2b = await prisma.lesson.create({
      data: {
        tenant_id: tenantA.id,
        module_id: module2a.id,
        title: 'Avionics Integration Quiz',
        type: 'MCQ',
        content: 'Test your knowledge on modern glass cockpit systems and avionics integration.',
      },
    });
  }

  const lesson2bQuestions = await prisma.quizQuestion.count({
    where: { tenant_id: tenantA.id, lesson_id: lesson2b.id },
  });

  if (lesson2bQuestions === 0) {
    await prisma.quizQuestion.createMany({
      data: [
        {
          tenant_id: tenantA.id,
          lesson_id: lesson2b.id,
          question: 'What is the primary advantage of glass cockpit systems?',
          options: ['Reduced weight only', 'Integrated data presentation and automation', 'Lower fuel consumption', 'Better radio reception'],
          correct_option: 1,
        },
        {
          tenant_id: tenantA.id,
          lesson_id: lesson2b.id,
          question: 'GPS accuracy is primarily affected by:',
          options: ['Aircraft speed', 'Satellite geometry and atmospheric conditions', 'Time of day', 'Fuel quantity'],
          correct_option: 1,
        },
        {
          tenant_id: tenantA.id,
          lesson_id: lesson2b.id,
          question: 'Which backup system should you rely on if GPS is unavailable?',
          options: ['VOR/DME navigation', 'Autopilot alone', 'Radar only', 'None - always have GPS'],
          correct_option: 0,
        },
      ],
    });
  }

  // === Example Course 3: Emergency Procedures ===
  let course3 = await prisma.course.findFirst({
    where: { tenant_id: tenantA.id, title: 'Emergency Procedures & Crisis Management' },
  });

  if (!course3) {
    course3 = await prisma.course.create({
      data: {
        tenant_id: tenantA.id,
        title: 'Emergency Procedures & Crisis Management',
        description: 'Comprehensive training on handling emergency situations, system failures, and decision-making under pressure.',
      },
    });
  }

  let module3a = await prisma.learningModule.findFirst({
    where: { tenant_id: tenantA.id, course_id: course3.id, title: 'Engine Failures' },
  });

  if (!module3a) {
    module3a = await prisma.learningModule.create({
      data: {
        tenant_id: tenantA.id,
        course_id: course3.id,
        title: 'Engine Failures',
      },
    });
  }

  let lesson3a = await prisma.lesson.findFirst({
    where: { tenant_id: tenantA.id, module_id: module3a.id, title: 'Engine Failure Recognition' },
  });

  if (!lesson3a) {
    lesson3a = await prisma.lesson.create({
      data: {
        tenant_id: tenantA.id,
        module_id: module3a.id,
        title: 'Engine Failure Recognition',
        type: 'TEXT',
        content: 'Engine failure indicators include sudden loss of power, vibration, unusual sounds, and instrument indications. Immediate action: Control the aircraft, establish safe flight path, declare emergency to ATC, and execute emergency procedures.',
      },
    });
  }

  let lesson3b = await prisma.lesson.findFirst({
    where: { tenant_id: tenantA.id, module_id: module3a.id, title: 'Engine Failure Response' },
  });

  if (!lesson3b) {
    lesson3b = await prisma.lesson.create({
      data: {
        tenant_id: tenantA.id,
        module_id: module3a.id,
        title: 'Engine Failure Response',
        type: 'MCQ',
        content: 'Test your knowledge on proper response procedures to engine failures.',
      },
    });
  }

  const lesson3bQuestions = await prisma.quizQuestion.count({
    where: { tenant_id: tenantA.id, lesson_id: lesson3b.id },
  });

  if (lesson3bQuestions === 0) {
    await prisma.quizQuestion.createMany({
      data: [
        {
          tenant_id: tenantA.id,
          lesson_id: lesson3b.id,
          question: 'First priority in engine failure is to:',
          options: ['Declare emergency', 'Control the aircraft and establish safe flight path', 'Check fuel selector', 'Calculate distance to nearest airport'],
          correct_option: 1,
        },
        {
          tenant_id: tenantA.id,
          lesson_id: lesson3b.id,
          question: 'After engine failure, what is the correct glide speed?',
          options: ['Cruise speed', 'Best glide speed (Vg)', 'Stall speed plus 10 knots', 'Current airspeed minus 10 knots'],
          correct_option: 1,
        },
      ],
    });
  }

  console.log('Seed completed.');
  console.log('');
  console.log('📚 EXAMPLE COURSES CREATED:');
  console.log('1. Private Pilot 101');
  console.log('   └─ Aerodynamics Basics');
  console.log('      ├─ Lift, Drag, and Stability Quiz (MCQ)');
  console.log('');
  console.log('2. Advanced Navigation & Instrument Flying');
  console.log('   └─ GPS and Modern Avionics');
  console.log('      ├─ GPS Systems Overview (TEXT)');
  console.log('      └─ Avionics Integration Quiz (MCQ)');
  console.log('');
  console.log('3. Emergency Procedures & Crisis Management');
  console.log('   └─ Engine Failures');
  console.log('      ├─ Engine Failure Recognition (TEXT)');
  console.log('      └─ Engine Failure Response (MCQ)');
  console.log('');
  console.log('✈️  LOGIN CREDENTIALS:');
  console.log('- studenta@test.com / password    (Student)');
  console.log('- instructora@test.com / password (Instructor)');
  console.log('- studentb@test.com / password    (Student)');
  console.log('- admina@test.com / password      (Admin)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
