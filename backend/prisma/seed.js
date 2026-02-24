"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-unused-vars */
var client_1 = require("@prisma/client");
var argon2 = require("argon2");
var crypto = require("crypto");
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var tenantAId, tenantBId, tenantA, tenantB, _a, adminRoleA, instructorRoleA, studentRoleA, hashedBasePassword, demoPasswordHash, _b, studentA, instructorA, adminA, studentB, _c, _d, _e, _f, _g, course1, mod1, lesson1_1, lesson1_2, q1_existing, course2, mod2, lesson2_1, lesson2_2, q2_existing, course3, mod3, lesson3_1, lesson3_2, q3_existing;
        var _h, _j;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    tenantAId = '11111111-1111-1111-1111-111111111111';
                    tenantBId = '22222222-2222-2222-2222-222222222222';
                    console.log('🌱 Seeding database...');
                    return [4 /*yield*/, prisma.tenant.upsert({
                            where: { tenant_id: tenantAId },
                            create: { id: tenantAId, tenant_id: tenantAId, name: 'Flight School A' },
                            update: { name: 'Flight School A' },
                        })];
                case 1:
                    tenantA = _k.sent();
                    return [4 /*yield*/, prisma.tenant.upsert({
                            where: { tenant_id: tenantBId },
                            create: { id: tenantBId, tenant_id: tenantBId, name: 'Flight School B' },
                            update: { name: 'Flight School B' },
                        })];
                case 2:
                    tenantB = _k.sent();
                    return [4 /*yield*/, Promise.all([
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
                        ])];
                case 3:
                    _a = _k.sent(), adminRoleA = _a[0], instructorRoleA = _a[1], studentRoleA = _a[2];
                    hashedBasePassword = crypto.createHash('sha256').update('password').digest('hex');
                    return [4 /*yield*/, argon2.hash(hashedBasePassword)];
                case 4:
                    demoPasswordHash = _k.sent();
                    _d = (_c = Promise).all;
                    _e = [prisma.user.upsert({
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
                        })];
                    _g = (_f = prisma.user).upsert;
                    _h = {
                        where: { tenant_id_email: { tenant_id: tenantB.id, email: 'studentb@test.com' } }
                    };
                    _j = {
                        tenant_id: tenantB.id
                    };
                    return [4 /*yield*/, prisma.role.upsert({
                            where: { tenant_id_name: { tenant_id: tenantB.id, name: 'student' } },
                            create: { tenant_id: tenantB.id, name: 'student' },
                            update: {},
                        })];
                case 5: return [4 /*yield*/, _d.apply(_c, [_e.concat([
                            _g.apply(_f, [(_h.create = (_j.roleId = (_k.sent()).id,
                                    _j.email = 'studentb@test.com',
                                    _j.passwordHash = demoPasswordHash,
                                    _j.name = 'Student B',
                                    _j),
                                    _h.update = {
                                        passwordHash: demoPasswordHash,
                                        name: 'Student B',
                                    },
                                    _h)])
                        ])])];
                case 6:
                    _b = _k.sent(), studentA = _b[0], instructorA = _b[1], adminA = _b[2], studentB = _b[3];
                    return [4 /*yield*/, prisma.course.upsert({
                            where: { id: '10000000-0000-0000-0000-000000000001' },
                            create: {
                                id: '10000000-0000-0000-0000-000000000001',
                                tenant_id: tenantA.id,
                                title: 'Private Pilot 101',
                                description: 'Foundational pilot training covering safety, aerodynamics, and navigation.',
                            },
                            update: {},
                        })];
                case 7:
                    course1 = _k.sent();
                    return [4 /*yield*/, prisma.learningModule.upsert({
                            where: { id: '20000000-0000-0000-0000-000000000001' },
                            create: {
                                id: '20000000-0000-0000-0000-000000000001',
                                tenant_id: tenantA.id,
                                course_id: course1.id,
                                title: 'Aerodynamics Basics',
                            },
                            update: {},
                        })];
                case 8:
                    mod1 = _k.sent();
                    return [4 /*yield*/, prisma.lesson.upsert({
                            where: { id: '30000000-0000-0000-0000-000000000001' },
                            create: {
                                id: '30000000-0000-0000-0000-000000000001',
                                tenant_id: tenantA.id,
                                module_id: mod1.id,
                                title: 'Understanding Lift and Drag',
                                type: 'TEXT',
                                content: "# Lift and Drag Forces\n\n## What Creates Lift?\nLift is generated by the pressure difference between the upper and lower surfaces of the wing. As air flows over the curved upper surface, it travels faster than air under the lower surface, creating lower pressure above and higher pressure below.\n\n## The Four Forces of Flight\n- **Thrust** - Forward motion from engines\n- **Drag** - Air resistance opposing motion\n- **Lift** - Upward force perpendicular to airflow\n- **Weight** - Gravitational force downward\n\n## Drag Types\n- **Parasite Drag** - From fuselage, landing gear, etc.\n- **Induced Drag** - Created by lift generation at wing tips\n- **Form Drag** - Shape resistance through air",
                            },
                            update: {},
                        })];
                case 9:
                    lesson1_1 = _k.sent();
                    return [4 /*yield*/, prisma.lesson.upsert({
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
                        })];
                case 10:
                    lesson1_2 = _k.sent();
                    return [4 /*yield*/, prisma.quizQuestion.count({
                            where: { lesson_id: lesson1_2.id },
                        })];
                case 11:
                    q1_existing = _k.sent();
                    if (!(q1_existing === 0)) return [3 /*break*/, 13];
                    return [4 /*yield*/, prisma.quizQuestion.createMany({
                            data: [
                                { tenant_id: tenantA.id, lesson_id: lesson1_2.id, question: 'Which force directly opposes thrust?', options: ['Lift', 'Weight', 'Drag', 'Torque'], correct_option: 2 },
                                { tenant_id: tenantA.id, lesson_id: lesson1_2.id, question: 'Increasing angle of attack increases lift until?', options: ['Engine throttle', 'Critical angle/stall', 'Landing gear', 'Fuel burn'], correct_option: 1 },
                                { tenant_id: tenantA.id, lesson_id: lesson1_2.id, question: 'What causes induced drag?', options: ['Surface friction', 'Wing tip vortices', 'Engine RPM', 'Altitude'], correct_option: 1 },
                                { tenant_id: tenantA.id, lesson_id: lesson1_2.id, question: 'A stall occurs when angle of attack exceeds?', options: ['90 degrees', 'Critical angle', 'Climb angle', 'Bank angle'], correct_option: 1 },
                                { tenant_id: tenantA.id, lesson_id: lesson1_2.id, question: 'Which is NOT a type of drag?', options: ['Parasite drag', 'Induced drag', 'Form drag', 'Lift drag'], correct_option: 3 },
                            ],
                        })];
                case 12:
                    _k.sent();
                    _k.label = 13;
                case 13: return [4 /*yield*/, prisma.course.upsert({
                        where: { id: '10000000-0000-0000-0000-000000000002' },
                        create: {
                            id: '10000000-0000-0000-0000-000000000002',
                            tenant_id: tenantA.id,
                            title: 'Advanced Navigation & Instrument Flying',
                            description: 'Master GPS, avionics, and instrument flight procedures.',
                        },
                        update: {},
                    })];
                case 14:
                    course2 = _k.sent();
                    return [4 /*yield*/, prisma.learningModule.upsert({
                            where: { id: '20000000-0000-0000-0000-000000000002' },
                            create: {
                                id: '20000000-0000-0000-0000-000000000002',
                                tenant_id: tenantA.id,
                                course_id: course2.id,
                                title: 'GPS and Modern Avionics',
                            },
                            update: {},
                        })];
                case 15:
                    mod2 = _k.sent();
                    return [4 /*yield*/, prisma.lesson.upsert({
                            where: { id: '30000000-0000-0000-0000-000000000003' },
                            create: {
                                id: '30000000-0000-0000-0000-000000000003',
                                tenant_id: tenantA.id,
                                module_id: mod2.id,
                                title: 'GPS Systems Overview',
                                type: 'TEXT',
                                content: "# GPS and Avionics\n\n## How GPS Works\nThe Global Positioning System uses 24+ satellites to triangulate your position. Your aircraft receiver needs signals from at least 4 satellites for accurate 3D positioning.\n\n## Glass Cockpit Systems\nModern glass cockpits display:\n- Primary Flight Display (PFD)\n- Multi-Function Display (MFD)\n- Engine indication systems\n- Navigation overlays\n\n## VOR Navigation\nVOR (VHF Omnidirectional Range) stations provide compass-like navigation reference points across the country.",
                            },
                            update: {},
                        })];
                case 16:
                    lesson2_1 = _k.sent();
                    return [4 /*yield*/, prisma.lesson.upsert({
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
                        })];
                case 17:
                    lesson2_2 = _k.sent();
                    return [4 /*yield*/, prisma.quizQuestion.count({
                            where: { lesson_id: lesson2_2.id },
                        })];
                case 18:
                    q2_existing = _k.sent();
                    if (!(q2_existing < 5)) return [3 /*break*/, 21];
                    return [4 /*yield*/, prisma.quizQuestion.deleteMany({ where: { lesson_id: lesson2_2.id } })];
                case 19:
                    _k.sent();
                    return [4 /*yield*/, prisma.quizQuestion.createMany({
                            data: [
                                { tenant_id: tenantA.id, lesson_id: lesson2_2.id, question: 'What is the primary advantage of glass cockpit systems?', options: ['Cheaper maintenance', 'Integrated displays', 'Lighter weight', 'Easier installation'], correct_option: 1 },
                                { tenant_id: tenantA.id, lesson_id: lesson2_2.id, question: 'GPS accuracy is primarily affected by?', options: ['Solar activity', 'Altitude', 'Satellite geometry', 'Flight speed'], correct_option: 2 },
                                { tenant_id: tenantA.id, lesson_id: lesson2_2.id, question: 'Which backup system should you rely on if GPS is unavailable?', options: ['VOR/DME', 'ADS-B', 'WAAS', 'Radar'], correct_option: 0 },
                                { tenant_id: tenantA.id, lesson_id: lesson2_2.id, question: 'How many GPS satellites are needed for 3D positioning?', options: ['2', '3', '4', '5'], correct_option: 2 },
                                { tenant_id: tenantA.id, lesson_id: lesson2_2.id, question: 'PFD stands for?', options: ['Primary Flight Display', 'Pilot Function Data', 'Precision Flight Data', 'Primary Frequency Display'], correct_option: 0 },
                            ],
                        })];
                case 20:
                    _k.sent();
                    _k.label = 21;
                case 21: return [4 /*yield*/, prisma.course.upsert({
                        where: { id: '10000000-0000-0000-0000-000000000003' },
                        create: {
                            id: '10000000-0000-0000-0000-000000000003',
                            tenant_id: tenantA.id,
                            title: 'Emergency Procedures & Crisis Management',
                            description: 'Comprehensive emergency response training.',
                        },
                        update: {},
                    })];
                case 22:
                    course3 = _k.sent();
                    return [4 /*yield*/, prisma.learningModule.upsert({
                            where: { id: '20000000-0000-0000-0000-000000000003' },
                            create: {
                                id: '20000000-0000-0000-0000-000000000003',
                                tenant_id: tenantA.id,
                                course_id: course3.id,
                                title: 'Engine Failures',
                            },
                            update: {},
                        })];
                case 23:
                    mod3 = _k.sent();
                    return [4 /*yield*/, prisma.lesson.upsert({
                            where: { id: '30000000-0000-0000-0000-000000000005' },
                            create: {
                                id: '30000000-0000-0000-0000-000000000005',
                                tenant_id: tenantA.id,
                                module_id: mod3.id,
                                title: 'Engine Failure Recognition',
                                type: 'TEXT',
                                content: "# Engine Emergency Response\n\n## Engine Failure Symptoms\n- Sudden loss of power\n- Excessive vibration\n- Unusual instrument readings\n- Fire or smoke\n\n## Immediate Actions\n1. **Maintain aircraft control** - Trim for glide\n2. **Switch fuel pump ON** - Ensure adequate flow\n3. **Check mixture/mag switches** - Attempt restart\n4. **Declare emergency** - Contact ATC on 121.5\n5. **Plan landing area** - Find suitable runway or field",
                            },
                            update: {},
                        })];
                case 24:
                    lesson3_1 = _k.sent();
                    return [4 /*yield*/, prisma.lesson.upsert({
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
                        })];
                case 25:
                    lesson3_2 = _k.sent();
                    return [4 /*yield*/, prisma.quizQuestion.count({
                            where: { lesson_id: lesson3_2.id },
                        })];
                case 26:
                    q3_existing = _k.sent();
                    if (!(q3_existing < 5)) return [3 /*break*/, 29];
                    return [4 /*yield*/, prisma.quizQuestion.deleteMany({ where: { lesson_id: lesson3_2.id } })];
                case 27:
                    _k.sent();
                    return [4 /*yield*/, prisma.quizQuestion.createMany({
                            data: [
                                { tenant_id: tenantA.id, lesson_id: lesson3_2.id, question: 'Upon engine failure, your first priority is?', options: ['Call ATC', 'Maintain aircraft control', 'Switch tanks', 'Restart engine'], correct_option: 1 },
                                { tenant_id: tenantA.id, lesson_id: lesson3_2.id, question: 'After engine failure, you should descend at?', options: ['Maximum rate', 'Glide speed for maximum distance', 'Cruise speed', 'Climb to find air'], correct_option: 1 },
                                { tenant_id: tenantA.id, lesson_id: lesson3_2.id, question: 'Emergency frequency is?', options: ['119.5', '121.5', '118.0', '123.0'], correct_option: 1 },
                                { tenant_id: tenantA.id, lesson_id: lesson3_2.id, question: 'You should attempt restart by?', options: ['Increasing throttle', 'Switching to alternate fuel', 'Lowering nose', 'All of above'], correct_option: 3 },
                                { tenant_id: tenantA.id, lesson_id: lesson3_2.id, question: 'Best landing option after engine failure?', options: ['Any road', 'River', 'Into wind, clear terrain', 'Nearest highway'], correct_option: 2 },
                            ],
                        })];
                case 28:
                    _k.sent();
                    _k.label = 29;
                case 29:
                    console.log('✅ Seed completed successfully!');
                    console.log('\n📚 Courses seeded: 3');
                    console.log('📝 Lessons seeded: 6 (3 TEXT + 3 MCQ)');
                    console.log('❓ Quiz questions: 15 total (5 per quiz)');
                    console.log('\n👤 Demo credentials:');
                    console.log('   studenta@test.com / password    (Student)');
                    console.log('   instructora@test.com / password (Instructor)');
                    console.log('   admina@test.com / password      (Admin)');
                    console.log('   studentb@test.com / password    (Student, School B)');
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error('❌ Seed error:', e);
    process.exit(1);
})
    .finally(function () { return prisma.$disconnect(); });
