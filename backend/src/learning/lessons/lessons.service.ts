import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface QuizAnswerInput {
  questionId: string;
  answer: number;
}

const PASS_THRESHOLD = 0.7;

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService) {}

  private gradeQuiz(
    questions: { id: string; correct_option: number }[],
    answers: QuizAnswerInput[],
  ) {
    let score = 0;
    const incorrectQuestions: { questionId: string; correctAnswer: number }[] = [];
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    for (const ans of answers) {
      const dbQuestion = questionMap.get(ans.questionId);
      if (dbQuestion) {
        if (dbQuestion.correct_option === ans.answer) {
          score++;
        } else {
          incorrectQuestions.push({
            questionId: dbQuestion.id,
            correctAnswer: dbQuestion.correct_option,
          });
        }
      }
    }

    return { score, incorrectQuestions };
  }

  private async propagateCompletion(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentId: string,
    lessonId: string,
    moduleId: string,
    courseId: string,
    passed: boolean,
  ) {
    let lessonCompleted = false;
    let moduleCompleted = false;
    let courseCompleted = false;

    const existingLessonProgress = await tx.lessonProgress.findUnique({
      where: {
        tenant_id_student_id_lesson_id: {
          tenant_id: tenantId,
          student_id: studentId,
          lesson_id: lessonId,
        },
      },
    });

    if (passed) {
      if (!existingLessonProgress || existingLessonProgress.status !== 'completed') {
        await tx.lessonProgress.upsert({
          where: {
            tenant_id_student_id_lesson_id: {
              tenant_id: tenantId,
              student_id: studentId,
              lesson_id: lessonId,
            },
          },
          update: {
            status: 'completed',
            completed_at: new Date(),
          },
          create: {
            tenant_id: tenantId,
            student_id: studentId,
            lesson_id: lessonId,
            status: 'completed',
            completed_at: new Date(),
          },
        });
      }
      lessonCompleted = true;
    } else if (!existingLessonProgress) {
      await tx.lessonProgress.create({
        data: {
          tenant_id: tenantId,
          student_id: studentId,
          lesson_id: lessonId,
          status: 'in_progress',
        },
      });
    }

    if (!lessonCompleted) {
      return { lessonCompleted, moduleCompleted, courseCompleted };
    }

    const [totalLessonsInModule, completedLessonsInModule] = await Promise.all([
      tx.lesson.count({
        where: { tenant_id: tenantId, module_id: moduleId },
      }),
      tx.lessonProgress.count({
        where: {
          tenant_id: tenantId,
          student_id: studentId,
          status: 'completed',
          lesson: {
            tenant_id: tenantId,
            module_id: moduleId,
          },
        },
      }),
    ]);

    if (totalLessonsInModule > 0 && completedLessonsInModule >= totalLessonsInModule) {
      const existingModuleProgress = await tx.moduleProgress.findUnique({
        where: {
          tenant_id_student_id_module_id: {
            tenant_id: tenantId,
            student_id: studentId,
            module_id: moduleId,
          },
        },
      });

      if (!existingModuleProgress || existingModuleProgress.status !== 'completed') {
        await tx.moduleProgress.upsert({
          where: {
            tenant_id_student_id_module_id: {
              tenant_id: tenantId,
              student_id: studentId,
              module_id: moduleId,
            },
          },
          update: {
            status: 'completed',
            completed_at: new Date(),
          },
          create: {
            tenant_id: tenantId,
            student_id: studentId,
            module_id: moduleId,
            status: 'completed',
            completed_at: new Date(),
          },
        });
      }

      moduleCompleted = true;
    }

    if (!moduleCompleted) {
      return { lessonCompleted, moduleCompleted, courseCompleted };
    }

    const [totalModulesInCourse, completedModulesInCourse] = await Promise.all([
      tx.learningModule.count({
        where: { tenant_id: tenantId, course_id: courseId },
      }),
      tx.moduleProgress.count({
        where: {
          tenant_id: tenantId,
          student_id: studentId,
          status: 'completed',
          module: {
            tenant_id: tenantId,
            course_id: courseId,
          },
        },
      }),
    ]);

    if (totalModulesInCourse > 0 && completedModulesInCourse >= totalModulesInCourse) {
      const existingCourseProgress = await tx.courseProgress.findUnique({
        where: {
          tenant_id_student_id_course_id: {
            tenant_id: tenantId,
            student_id: studentId,
            course_id: courseId,
          },
        },
      });

      if (!existingCourseProgress || existingCourseProgress.status !== 'completed') {
        await tx.courseProgress.upsert({
          where: {
            tenant_id_student_id_course_id: {
              tenant_id: tenantId,
              student_id: studentId,
              course_id: courseId,
            },
          },
          update: {
            status: 'completed',
            completed_at: new Date(),
          },
          create: {
            tenant_id: tenantId,
            student_id: studentId,
            course_id: courseId,
            status: 'completed',
            completed_at: new Date(),
          },
        });
      }
      courseCompleted = true;
    }

    return { lessonCompleted, moduleCompleted, courseCompleted };
  }

  async getLesson(tenantId: string, id: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        questions: {
          select: {
            id: true,
            question: true,
            options: true,
            // DO NOT SELECT correct_option here!
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    return lesson;
  }

  async attemptQuiz(tenantId: string, lessonId: string, studentId: string, answers: QuizAnswerInput[]) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, tenant_id: tenantId },
      include: { questions: true, module: { select: { course_id: true } } },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    if (lesson.type !== 'MCQ') {
      throw new BadRequestException('Lesson is not a quiz');
    }

    if (!lesson.questions || lesson.questions.length === 0) {
      throw new BadRequestException('Quiz has no questions to attempt');
    }

    const { score, incorrectQuestions } = this.gradeQuiz(lesson.questions, answers);
    const total = lesson.questions.length;
    const passed = total > 0 && score / total >= PASS_THRESHOLD;

    const result = await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.quizAttempt.create({
        data: {
          tenant_id: tenantId,
          student_id: studentId,
          lesson_id: lessonId,
          score,
          total,
          answers: answers as unknown as Prisma.InputJsonValue,
        },
      });

      const completion = await this.propagateCompletion(
        tx,
        tenantId,
        studentId,
        lessonId,
        lesson.module_id,
        lesson.module.course_id,
        passed,
      );

      return { attempt, completion };
    });

    return {
      attemptId: result.attempt.id,
      score,
      total,
      incorrectQuestions,
      lessonCompleted: result.completion.lessonCompleted,
      moduleCompleted: result.completion.moduleCompleted,
      courseCompleted: result.completion.courseCompleted,
    };
  }

  /**
   * Mark a TEXT lesson as complete for a student.
   * Triggers module/course completion propagation atomically.
   */
  async markTextLessonComplete(tenantId: string, lessonId: string, studentId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, tenant_id: tenantId },
      include: { module: { select: { course_id: true } } },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    if (lesson.type !== 'TEXT') {
      throw new BadRequestException('Use POST /lessons/:id/attempt for MCQ lessons');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      return this.propagateCompletion(
        tx,
        tenantId,
        studentId,
        lessonId,
        lesson.module_id,
        lesson.module.course_id,
        true,
      );
    });

    return {
      lessonCompleted: result.lessonCompleted,
      moduleCompleted: result.moduleCompleted,
      courseCompleted: result.courseCompleted,
    };
  }

  /**
   * Sync offline quiz attempt from client
   * Handles duplicate detection and validation
   */
  async syncOfflineAttempt(
    tenantId: string,
    lessonId: string,
    studentId: string,
    answers: QuizAnswerInput[],
    clientId: string,
  ) {
    // Check if already synced (idempotency)
    const existing = await this.prisma.quizAttempt.findFirst({
      where: {
        tenant_id: tenantId,
        student_id: studentId,
        lesson_id: lessonId,
        source: 'offline', // Track offline syncs
        external_id: clientId, // Client-generated ID for deduplication
      },
    });

    // If already exists, return the existing attempt
    if (existing) {
      return {
        attemptId: existing.id,
        score: existing.score,
        total: existing.total || 0,
        duplicateSync: true,
      };
    }

    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, tenant_id: tenantId },
      include: { questions: true, module: { select: { course_id: true } } },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    if (lesson.type !== 'MCQ') {
      throw new BadRequestException('Lesson is not a quiz');
    }

    const { score, incorrectQuestions } = this.gradeQuiz(lesson.questions, answers);
    const total = lesson.questions.length;
    const passed = total > 0 && score / total >= PASS_THRESHOLD;

    const result = await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.quizAttempt.create({
        data: {
          tenant_id: tenantId,
          student_id: studentId,
          lesson_id: lessonId,
          score,
          total,
          answers: answers as unknown as Prisma.InputJsonValue,
          source: 'offline',
          external_id: clientId,
        },
      });

      const completion = await this.propagateCompletion(
        tx,
        tenantId,
        studentId,
        lessonId,
        lesson.module_id,
        lesson.module.course_id,
        passed,
      );

      return { attempt, completion };
    });

    return {
      attemptId: result.attempt.id,
      score,
      total,
      incorrectQuestions,
      duplicateSync: false,
      lessonCompleted: result.completion.lessonCompleted,
      moduleCompleted: result.completion.moduleCompleted,
      courseCompleted: result.completion.courseCompleted,
    };
  }
}
