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
var client_1 = require("@prisma/client");
var argon2 = require("argon2");
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var tenantA, tenantB, rolesA, rolesB, passwordHash, studentA, instructorA, adminA, studentB, course, module, lesson, q1, q2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log('Seeding Database...');
                    // Clean up
                    return [4 /*yield*/, prisma.tenant.deleteMany()];
                case 1:
                    // Clean up
                    _c.sent();
                    return [4 /*yield*/, prisma.tenant.create({ data: { tenant_id: '11111111-1111-1111-1111-111111111111', name: 'Flight School A' } })];
                case 2:
                    tenantA = _c.sent();
                    return [4 /*yield*/, prisma.tenant.create({ data: { tenant_id: '22222222-2222-2222-2222-222222222222', name: 'Flight School B' } })];
                case 3:
                    tenantB = _c.sent();
                    _a = {};
                    return [4 /*yield*/, prisma.role.create({ data: { tenant_id: tenantA.id, name: 'admin' } })];
                case 4:
                    _a.admin = _c.sent();
                    return [4 /*yield*/, prisma.role.create({ data: { tenant_id: tenantA.id, name: 'instructor' } })];
                case 5:
                    _a.instructor = _c.sent();
                    return [4 /*yield*/, prisma.role.create({ data: { tenant_id: tenantA.id, name: 'student' } })];
                case 6:
                    rolesA = (_a.student = _c.sent(),
                        _a);
                    _b = {};
                    return [4 /*yield*/, prisma.role.create({ data: { tenant_id: tenantB.id, name: 'student' } })];
                case 7:
                    rolesB = (_b.student = _c.sent(),
                        _b);
                    return [4 /*yield*/, argon2.hash('password')];
                case 8:
                    passwordHash = _c.sent();
                    return [4 /*yield*/, prisma.user.create({
                            data: { tenant_id: tenantA.id, roleId: rolesA.student.id, email: 'studenta@test.com', passwordHash: passwordHash, name: 'Student A' }
                        })];
                case 9:
                    studentA = _c.sent();
                    return [4 /*yield*/, prisma.user.create({
                            data: { tenant_id: tenantA.id, roleId: rolesA.instructor.id, email: 'instructora@test.com', passwordHash: passwordHash, name: 'Instructor A' }
                        })];
                case 10:
                    instructorA = _c.sent();
                    return [4 /*yield*/, prisma.user.create({
                            data: { tenant_id: tenantA.id, roleId: rolesA.admin.id, email: 'admina@test.com', passwordHash: passwordHash, name: 'Admin A' }
                        })];
                case 11:
                    adminA = _c.sent();
                    return [4 /*yield*/, prisma.user.create({
                            data: { tenant_id: tenantB.id, roleId: rolesB.student.id, email: 'studentb@test.com', passwordHash: passwordHash, name: 'Student B' }
                        })];
                case 12:
                    studentB = _c.sent();
                    return [4 /*yield*/, prisma.course.create({
                            data: { tenant_id: tenantA.id, title: 'Private Pilot 101', description: 'Intro course' }
                        })];
                case 13:
                    course = _c.sent();
                    return [4 /*yield*/, prisma.learningModule.create({
                            data: { tenant_id: tenantA.id, course_id: course.id, title: 'Aerodynamics' }
                        })];
                case 14:
                    module = _c.sent();
                    return [4 /*yield*/, prisma.lesson.create({
                            data: { tenant_id: tenantA.id, module_id: module.id, title: 'Lift & Drag', type: 'MCQ', content: 'Quiz time!' }
                        })];
                case 15:
                    lesson = _c.sent();
                    return [4 /*yield*/, prisma.quizQuestion.create({
                            data: {
                                tenant_id: tenantA.id,
                                lesson_id: lesson.id,
                                question: 'What creates lift?',
                                options: ['Airfoil shape', 'Magic', 'Engines only', 'Gravity'],
                                correct_option: 0
                            }
                        })];
                case 16:
                    q1 = _c.sent();
                    return [4 /*yield*/, prisma.quizQuestion.create({
                            data: {
                                tenant_id: tenantA.id,
                                lesson_id: lesson.id,
                                question: 'What opposes thrust?',
                                options: ['Lift', 'Drag', 'Weight', 'Speed'],
                                correct_option: 1
                            }
                        })];
                case 17:
                    q2 = _c.sent();
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
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) { console.error(e); process.exit(1); })
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
    switch (_a.label) {
        case 0: return [4 /*yield*/, prisma.$disconnect()];
        case 1:
            _a.sent();
            return [2 /*return*/];
    }
}); }); });
