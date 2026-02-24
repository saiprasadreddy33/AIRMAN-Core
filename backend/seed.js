"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-unused-vars */
const client_1 = require("@prisma/client");
const argon2 = __importStar(require("argon2"));
const crypto = __importStar(require("crypto"));
const prisma = new client_1.PrismaClient();
async function main() {
    const tenantAId = '11111111-1111-1111-1111-111111111111';
    const tenantBId = '22222222-2222-2222-2222-222222222222';
    console.log('🌱 Seeding database...');
    const tenantA = await prisma.tenant.upsert({
        where: { tenant_id: tenantAId },
        create: { id: tenantAId, tenant_id: tenantAId, name: 'Flight School A' },
        update: { name: 'Flight School A' },
    });
    const tenantB = await prisma.tenant.upsert({
        where: { tenant_id: tenantBId },
        create: { id: tenantBId, tenant_id: tenantBId, name: 'Flight School B' },
        update: { name: 'Flight School B' },
    });
    const [adminRoleA, instructorRoleA, studentRoleA, adminRoleB, instructorRoleB, studentRoleB] = await Promise.all([
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
            where: { tenant_id_name: { tenant_id: tenantB.id, name: 'admin' } },
            create: { tenant_id: tenantB.id, name: 'admin' },
            update: {},
        }),
        prisma.role.upsert({
            where: { tenant_id_name: { tenant_id: tenantB.id, name: 'instructor' } },
            create: { tenant_id: tenantB.id, name: 'instructor' },
            update: {},
        }),
        prisma.role.upsert({
            where: { tenant_id_name: { tenant_id: tenantB.id, name: 'student' } },
            create: { tenant_id: tenantB.id, name: 'student' },
            update: {},
        }),
    ]);
    const hashedBasePassword = crypto.createHash('sha256').update('password').digest('hex');
    const demoPasswordHash = await argon2.hash(hashedBasePassword);
    const [studentA, instructorA, adminA, studentB, instructorB, adminB] = await Promise.all([
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
        prisma.user.upsert({
            where: { tenant_id_email: { tenant_id: tenantB.id, email: 'instructorb@test.com' } },
            create: {
                tenant_id: tenantB.id,
                roleId: instructorRoleB.id,
                email: 'instructorb@test.com',
                passwordHash: demoPasswordHash,
                name: 'Instructor B',
            },
            update: {
                passwordHash: demoPasswordHash,
                roleId: instructorRoleB.id,
                name: 'Instructor B',
            },
        }),
        prisma.user.upsert({
            where: { tenant_id_email: { tenant_id: tenantB.id, email: 'adminb@test.com' } },
            create: {
                tenant_id: tenantB.id,
                roleId: adminRoleB.id,
                email: 'adminb@test.com',
                passwordHash: demoPasswordHash,
                name: 'Admin B',
            },
            update: {
                passwordHash: demoPasswordHash,
                roleId: adminRoleB.id,
                name: 'Admin B',
            },
        }),
    ]);
    // ============= COURSE 1: Private Pilot 101 =============
    const course1 = await prisma.course.upsert({
        where: { id: '10000000-0000-0000-0000-000000000001' },
        create: {
            id: '10000000-0000-0000-0000-000000000001',
            tenant_id: tenantA.id,
            title: 'Private Pilot 101',
            description: 'Foundational pilot training covering safety, aerodynamics, and navigation.',
        },
        update: {},
    });
    const mod1 = await prisma.learningModule.upsert({
        where: { id: '20000000-0000-0000-0000-000000000001' },
        create: {
            id: '20000000-0000-0000-0000-000000000001',
            tenant_id: tenantA.id,
            course_id: course1.id,
            title: 'Aerodynamics Basics',
        },
        update: {},
    });
    const lesson1_1 = await prisma.lesson.upsert({
        where: { id: '30000000-0000-0000-0000-000000000001' },
        create: {
            id: '30000000-0000-0000-0000-000000000001',
            tenant_id: tenantA.id,
            module_id: mod1.id,
            title: 'Understanding Lift and Drag',
            type: 'TEXT',
            content: `# Lift and Drag Forces

## What Creates Lift?
Lift is generated by the pressure difference between the upper and lower surfaces of the wing. As air flows over the curved upper surface, it travels faster than air under the lower surface, creating lower pressure above and higher pressure below.

## The Four Forces of Flight
- **Thrust** - Forward motion from engines
- **Drag** - Air resistance opposing motion
- **Lift** - Upward force perpendicular to airflow
- **Weight** - Gravitational force downward

## Drag Types
- **Parasite Drag** - From fuselage, landing gear, etc.
- **Induced Drag** - Created by lift generation at wing tips
- **Form Drag** - Shape resistance through air`,
        },
        update: {},
    });
    const lesson1_2 = await prisma.lesson.upsert({
        where: { id: '30000000-0000-0000-0000-000000000002' },
        create: {
            id: '30000000-0000-0000-0000-000000000002',
            tenant_id: tenantA.id,
            module_id: mod1.id,
            title: 'Aerodynamics Quiz',
            type: 'MCQ',
            content: 'Test your knowledge of aerodynamic principles.',
        },
        update: {},
    });
    // Add 5 questions for lesson1_2
    const q1_existing = await prisma.quizQuestion.count({
        where: { lesson_id: lesson1_2.id },
    });
    if (q1_existing === 0) {
        await prisma.quizQuestion.createMany({
            data: [
                { tenant_id: tenantA.id, lesson_id: lesson1_2.id, question: 'Which force directly opposes thrust?', options: ['Lift', 'Weight', 'Drag', 'Torque'], correct_option: 2 },
                { tenant_id: tenantA.id, lesson_id: lesson1_2.id, question: 'Increasing angle of attack increases lift until?', options: ['Engine throttle', 'Critical angle/stall', 'Landing gear', 'Fuel burn'], correct_option: 1 },
                { tenant_id: tenantA.id, lesson_id: lesson1_2.id, question: 'What causes induced drag?', options: ['Surface friction', 'Wing tip vortices', 'Engine RPM', 'Altitude'], correct_option: 1 },
                { tenant_id: tenantA.id, lesson_id: lesson1_2.id, question: 'A stall occurs when angle of attack exceeds?', options: ['90 degrees', 'Critical angle', 'Climb angle', 'Bank angle'], correct_option: 1 },
                { tenant_id: tenantA.id, lesson_id: lesson1_2.id, question: 'Which is NOT a type of drag?', options: ['Parasite drag', 'Induced drag', 'Form drag', 'Lift drag'], correct_option: 3 },
            ],
        });
    }
    // ============= COURSE 2: Advanced Navigation & Instrument Flying =============
    const course2 = await prisma.course.upsert({
        where: { id: '10000000-0000-0000-0000-000000000002' },
        create: {
            id: '10000000-0000-0000-0000-000000000002',
            tenant_id: tenantA.id,
            title: 'Advanced Navigation & Instrument Flying',
            description: 'Master GPS, avionics, and instrument flight procedures.',
        },
        update: {},
    });
    const mod2 = await prisma.learningModule.upsert({
        where: { id: '20000000-0000-0000-0000-000000000002' },
        create: {
            id: '20000000-0000-0000-0000-000000000002',
            tenant_id: tenantA.id,
            course_id: course2.id,
            title: 'GPS and Modern Avionics',
        },
        update: {},
    });
    const lesson2_1 = await prisma.lesson.upsert({
        where: { id: '30000000-0000-0000-0000-000000000003' },
        create: {
            id: '30000000-0000-0000-0000-000000000003',
            tenant_id: tenantA.id,
            module_id: mod2.id,
            title: 'GPS Systems Overview',
            type: 'TEXT',
            content: `# GPS and Avionics

## How GPS Works
The Global Positioning System uses 24+ satellites to triangulate your position. Your aircraft receiver needs signals from at least 4 satellites for accurate 3D positioning.

## Glass Cockpit Systems
Modern glass cockpits display:
- Primary Flight Display (PFD)
- Multi-Function Display (MFD)
- Engine indication systems
- Navigation overlays

## VOR Navigation
VOR (VHF Omnidirectional Range) stations provide compass-like navigation reference points across the country.`,
        },
        update: {},
    });
    const lesson2_2 = await prisma.lesson.upsert({
        where: { id: '30000000-0000-0000-0000-000000000004' },
        create: {
            id: '30000000-0000-0000-0000-000000000004',
            tenant_id: tenantA.id,
            module_id: mod2.id,
            title: 'Avionics Integration Quiz',
            type: 'MCQ',
            content: 'Test your understanding of modern avionics systems.',
        },
        update: {},
    });
    const q2_existing = await prisma.quizQuestion.count({
        where: { lesson_id: lesson2_2.id },
    });
    if (q2_existing < 5) {
        await prisma.quizQuestion.deleteMany({ where: { lesson_id: lesson2_2.id } });
        await prisma.quizQuestion.createMany({
            data: [
                { tenant_id: tenantA.id, lesson_id: lesson2_2.id, question: 'What is the primary advantage of glass cockpit systems?', options: ['Cheaper maintenance', 'Integrated displays', 'Lighter weight', 'Easier installation'], correct_option: 1 },
                { tenant_id: tenantA.id, lesson_id: lesson2_2.id, question: 'GPS accuracy is primarily affected by?', options: ['Solar activity', 'Altitude', 'Satellite geometry', 'Flight speed'], correct_option: 2 },
                { tenant_id: tenantA.id, lesson_id: lesson2_2.id, question: 'Which backup system should you rely on if GPS is unavailable?', options: ['VOR/DME', 'ADS-B', 'WAAS', 'Radar'], correct_option: 0 },
                { tenant_id: tenantA.id, lesson_id: lesson2_2.id, question: 'How many GPS satellites are needed for 3D positioning?', options: ['2', '3', '4', '5'], correct_option: 2 },
                { tenant_id: tenantA.id, lesson_id: lesson2_2.id, question: 'PFD stands for?', options: ['Primary Flight Display', 'Pilot Function Data', 'Precision Flight Data', 'Primary Frequency Display'], correct_option: 0 },
            ],
        });
    }
    // ============= COURSE 3: Emergency Procedures & Crisis Management =============
    const course3 = await prisma.course.upsert({
        where: { id: '10000000-0000-0000-0000-000000000003' },
        create: {
            id: '10000000-0000-0000-0000-000000000003',
            tenant_id: tenantA.id,
            title: 'Emergency Procedures & Crisis Management',
            description: 'Comprehensive emergency response training.',
        },
        update: {},
    });
    const mod3 = await prisma.learningModule.upsert({
        where: { id: '20000000-0000-0000-0000-000000000003' },
        create: {
            id: '20000000-0000-0000-0000-000000000003',
            tenant_id: tenantA.id,
            course_id: course3.id,
            title: 'Engine Failures',
        },
        update: {},
    });
    const lesson3_1 = await prisma.lesson.upsert({
        where: { id: '30000000-0000-0000-0000-000000000005' },
        create: {
            id: '30000000-0000-0000-0000-000000000005',
            tenant_id: tenantA.id,
            module_id: mod3.id,
            title: 'Engine Failure Recognition',
            type: 'TEXT',
            content: `# Engine Emergency Response

## Engine Failure Symptoms
- Sudden loss of power
- Excessive vibration
- Unusual instrument readings
- Fire or smoke

## Immediate Actions
1. **Maintain aircraft control** - Trim for glide
2. **Switch fuel pump ON** - Ensure adequate flow
3. **Check mixture/mag switches** - Attempt restart
4. **Declare emergency** - Contact ATC on 121.5
5. **Plan landing area** - Find suitable runway or field`,
        },
        update: {},
    });
    const lesson3_2 = await prisma.lesson.upsert({
        where: { id: '30000000-0000-0000-0000-000000000006' },
        create: {
            id: '30000000-0000-0000-0000-000000000006',
            tenant_id: tenantA.id,
            module_id: mod3.id,
            title: 'Engine Failure Response',
            type: 'MCQ',
            content: 'Emergency procedures knowledge check.',
        },
        update: {},
    });
    const q3_existing = await prisma.quizQuestion.count({
        where: { lesson_id: lesson3_2.id },
    });
    if (q3_existing < 5) {
        await prisma.quizQuestion.deleteMany({ where: { lesson_id: lesson3_2.id } });
        await prisma.quizQuestion.createMany({
            data: [
                { tenant_id: tenantA.id, lesson_id: lesson3_2.id, question: 'Upon engine failure, your first priority is?', options: ['Call ATC', 'Maintain aircraft control', 'Switch tanks', 'Restart engine'], correct_option: 1 },
                { tenant_id: tenantA.id, lesson_id: lesson3_2.id, question: 'After engine failure, you should descend at?', options: ['Maximum rate', 'Glide speed for maximum distance', 'Cruise speed', 'Climb to find air'], correct_option: 1 },
                { tenant_id: tenantA.id, lesson_id: lesson3_2.id, question: 'Emergency frequency is?', options: ['119.5', '121.5', '118.0', '123.0'], correct_option: 1 },
                { tenant_id: tenantA.id, lesson_id: lesson3_2.id, question: 'You should attempt restart by?', options: ['Increasing throttle', 'Switching to alternate fuel', 'Lowering nose', 'All of above'], correct_option: 3 },
                { tenant_id: tenantA.id, lesson_id: lesson3_2.id, question: 'Best landing option after engine failure?', options: ['Any road', 'River', 'Into wind, clear terrain', 'Nearest highway'], correct_option: 2 },
            ],
        });
    }
    console.log('✅ Seed completed successfully!');
    console.log('\n📚 Courses seeded: 3');
    console.log('📝 Lessons seeded: 6 (3 TEXT + 3 MCQ)');
    console.log('❓ Quiz questions: 15 total (5 per quiz)');
    console.log('\n👤 Demo credentials:');
    console.log('   School A');
    console.log('   - studenta@test.com / password    (Student)');
    console.log('   - instructora@test.com / password (Instructor)');
    console.log('   - admina@test.com / password      (Admin)');
    console.log('   School B');
    console.log('   - studentb@test.com / password    (Student)');
    console.log('   - instructorb@test.com / password (Instructor)');
    console.log('   - adminb@test.com / password      (Admin)');
}
main()
    .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
