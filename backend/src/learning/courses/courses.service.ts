import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuid } from 'uuid';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, title: string, description: string) {
    return this.prisma.course.create({
      data: {
        id: uuid(),
        tenant_id: tenantId,
        title,
        description: description || '',
      },
    });
  }

  async findAll(tenantId: string, page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;
    const where = {
      tenant_id: tenantId,
      ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { title: 'asc' },
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findModulesByCourse(tenantId: string, courseId: string, page = 1, limit = 10, search?: string) {
    // Verify course exists for this tenant
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, tenant_id: tenantId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const skip = (page - 1) * limit;
    const where = {
      course_id: courseId,
      tenant_id: tenantId,
      ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.learningModule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { title: 'asc' },
        include: {
          lessons: {
            select: { id: true, title: true, type: true }
          }
        }
      }),
      this.prisma.learningModule.count({ where })
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Returns a lightweight progress summary for all courses that a student has
   * started or completed. Designed for dashboard use — single round-trip.
   */
  async findMyProgressSummary(tenantId: string, studentId: string) {
    // All courses for the tenant
    const courses = await this.prisma.course.findMany({
      where: { tenant_id: tenantId },
      orderBy: { title: 'asc' },
      include: {
        progresses: {
          where: { student_id: studentId, tenant_id: tenantId },
          select: { status: true, completed_at: true },
        },
        modules: {
          where: { tenant_id: tenantId },
          include: {
            lessons: {
              where: { tenant_id: tenantId },
              select: { id: true },
            },
          },
        },
      },
    });

    // Fetch all LessonProgress for this student across all lessons in bulk
    const allLessonIds = courses.flatMap((c) =>
      c.modules.flatMap((m) => m.lessons.map((l) => l.id)),
    );

    const lessonProgresses =
      allLessonIds.length > 0
        ? await this.prisma.lessonProgress.findMany({
            where: {
              tenant_id: tenantId,
              student_id: studentId,
              lesson_id: { in: allLessonIds },
            },
            select: { lesson_id: true, status: true },
          })
        : [];

    const completedSet = new Set(
      lessonProgresses.filter((p) => p.status === 'completed').map((p) => p.lesson_id),
    );

    return courses
      .map((course) => {
        const totalLessons = course.modules.reduce((a, m) => a + m.lessons.length, 0);
        const completedLessons = course.modules.reduce(
          (a, m) => a + m.lessons.filter((l) => completedSet.has(l.id)).length,
          0,
        );
        const courseStatus = course.progresses[0]?.status ?? 'not_started';

        return {
          id: course.id,
          title: course.title,
          description: course.description,
          courseStatus,
          totalLessons,
          completedLessons,
          progressPercent:
            totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
        };
      })
      .filter((c) => c.completedLessons > 0 || c.courseStatus !== 'not_started');
  }

  /**
   * Returns course completion progress for a specific student.
   * Includes per-lesson and per-module completion status.
   * All queries are tenant-scoped for isolation.
   */
  async findCourseProgress(tenantId: string, courseId: string, studentId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, tenant_id: tenantId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Fetch modules with their lessons
    const modules = await this.prisma.learningModule.findMany({
      where: { course_id: courseId, tenant_id: tenantId },
      orderBy: { title: 'asc' },
      include: {
        lessons: {
          where: { tenant_id: tenantId },
          orderBy: { title: 'asc' },
          select: { id: true, title: true, type: true },
        },
        progresses: {
          where: { student_id: studentId, tenant_id: tenantId },
          select: { status: true, completed_at: true },
        },
      },
    });

    // Fetch all lesson-level progress for this student in one query
    const allLessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));

    const lessonProgresses = allLessonIds.length > 0
      ? await this.prisma.lessonProgress.findMany({
          where: {
            tenant_id: tenantId,
            student_id: studentId,
            lesson_id: { in: allLessonIds },
          },
          select: { lesson_id: true, status: true, completed_at: true },
        })
      : [];

    const lpMap = new Map(lessonProgresses.map((p) => [p.lesson_id, p]));

    // Fetch course-level progress
    const courseProgress = await this.prisma.courseProgress.findUnique({
      where: {
        tenant_id_student_id_course_id: {
          tenant_id: tenantId,
          student_id: studentId,
          course_id: courseId,
        },
      },
      select: { status: true, completed_at: true },
    });

    const totalLessons = allLessonIds.length;
    const completedLessons = lessonProgresses.filter((p) => p.status === 'completed').length;

    return {
      courseId,
      courseStatus: courseProgress?.status ?? 'not_started',
      courseCompletedAt: courseProgress?.completed_at ?? null,
      progressPercent:
        totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
      totalLessons,
      completedLessons,
      modules: modules.map((m) => ({
        id: m.id,
        title: m.title,
        moduleStatus: m.progresses[0]?.status ?? 'not_started',
        moduleCompletedAt: m.progresses[0]?.completed_at ?? null,
        lessons: m.lessons.map((l) => {
          const lp = lpMap.get(l.id);
          return {
            id: l.id,
            title: l.title,
            type: l.type,
            status: lp?.status ?? 'not_started',
            completed: lp?.status === 'completed',
            completedAt: lp?.completed_at ?? null,
          };
        }),
      })),
    };
  }
}
