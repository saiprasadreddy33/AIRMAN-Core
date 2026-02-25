import { Test, TestingModule } from '@nestjs/testing';
import { LessonsService } from './lessons.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('LessonsService', () => {
  let service: LessonsService;
  let prisma: {
    lesson: { findFirst: jest.Mock; count: jest.Mock };
    quizAttempt: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  const tenantId = '11111111-1111-1111-1111-111111111111';
  const lessonId = 'lesson-1';
  const studentId = 'student-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonsService,
        {
          provide: PrismaService,
          useValue: {
            lesson: { findFirst: jest.fn(), count: jest.fn() },
            quizAttempt: { findFirst: jest.fn() },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(LessonsService);
    prisma = module.get(PrismaService) as unknown as typeof prisma;
  });

  it('marks lesson/module/course completed when quiz passes', async () => {
    prisma.lesson.findFirst.mockResolvedValue({
      id: lessonId,
      tenant_id: tenantId,
      module_id: 'module-1',
      type: 'MCQ',
      questions: [{ id: 'q1', correct_option: 1 }],
      module: { course_id: 'course-1' },
    });

    const tx = {
      quizAttempt: { create: jest.fn().mockResolvedValue({ id: 'attempt-1' }) },
      lessonProgress: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(1),
      },
      lesson: { count: jest.fn().mockResolvedValue(1) },
      moduleProgress: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(1),
      },
      learningModule: { count: jest.fn().mockResolvedValue(1) },
      courseProgress: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.$transaction.mockImplementation(async (fn: (arg: typeof tx) => unknown) => fn(tx));

    const result = await service.attemptQuiz(tenantId, lessonId, studentId, [{ questionId: 'q1', answer: 1 }]);

    expect(result.lessonCompleted).toBe(true);
    expect(result.moduleCompleted).toBe(true);
    expect(result.courseCompleted).toBe(true);
    expect(tx.lessonProgress.upsert).toHaveBeenCalled();
    expect(tx.moduleProgress.upsert).toHaveBeenCalled();
    expect(tx.courseProgress.upsert).toHaveBeenCalled();
  });

  it('keeps lesson in_progress when quiz does not pass', async () => {
    prisma.lesson.findFirst.mockResolvedValue({
      id: lessonId,
      tenant_id: tenantId,
      module_id: 'module-1',
      type: 'MCQ',
      questions: [{ id: 'q1', correct_option: 1 }],
      module: { course_id: 'course-1' },
    });

    const tx = {
      quizAttempt: { create: jest.fn().mockResolvedValue({ id: 'attempt-2' }) },
      lessonProgress: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.$transaction.mockImplementation(async (fn: (arg: typeof tx) => unknown) => fn(tx));

    const result = await service.attemptQuiz(tenantId, lessonId, studentId, [{ questionId: 'q1', answer: 0 }]);

    expect(result.lessonCompleted).toBe(false);
    expect(result.moduleCompleted).toBe(false);
    expect(result.courseCompleted).toBe(false);
    expect(tx.lessonProgress.create).toHaveBeenCalledWith({
      data: {
        tenant_id: tenantId,
        student_id: studentId,
        lesson_id: lessonId,
        status: 'in_progress',
      },
    });
  });

  it('returns duplicate sync response for already-synced offline attempt', async () => {
    prisma.quizAttempt.findFirst.mockResolvedValue({
      id: 'existing-attempt',
      score: 1,
      total: 1,
    });

    const result = await service.syncOfflineAttempt(
      tenantId,
      lessonId,
      studentId,
      [{ questionId: 'q1', answer: 1 }],
      'device-attempt-1',
    );

    expect(result).toEqual({
      attemptId: 'existing-attempt',
      score: 1,
      total: 1,
      duplicateSync: true,
    });
  });
});
