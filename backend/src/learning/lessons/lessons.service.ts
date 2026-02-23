import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface QuizAnswerInput {
  questionId: string;
  answer: number;
}

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService) {}

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
      include: { questions: true },
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

    let score = 0;
    const incorrectQuestions: { questionId: string; correctAnswer: number }[] = [];
    const questionMap = new Map(lesson.questions.map((q) => [q.id, q]));

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

    // Persist attempt
    const attempt = await this.prisma.quizAttempt.create({
      data: {
        tenant_id: tenantId,
        student_id: studentId,
        lesson_id: lessonId,
        score,
        answers: answers as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      attemptId: attempt.id,
      score,
      total: lesson.questions.length,
      incorrectQuestions,
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

    // Grade and store attempt (same logic as online)
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, tenant_id: tenantId },
      include: { questions: true },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    if (lesson.type !== 'MCQ') {
      throw new BadRequestException('Lesson is not a quiz');
    }

    let score = 0;
    const incorrectQuestions: { questionId: string; correctAnswer: number }[] = [];
    const questionMap = new Map(lesson.questions.map((q) => [q.id, q]));

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

    // Store attempt with offline metadata
    const attempt = await this.prisma.quizAttempt.create({
      data: {
        tenant_id: tenantId,
        student_id: studentId,
        lesson_id: lessonId,
        score,
        total: lesson.questions.length,
        answers: answers as unknown as Prisma.InputJsonValue,
        source: 'offline',
        external_id: clientId,
      },
    });

    return {
      attemptId: attempt.id,
      score,
      total: lesson.questions.length,
      incorrectQuestions,
      duplicateSync: false,
    };
  }
}
