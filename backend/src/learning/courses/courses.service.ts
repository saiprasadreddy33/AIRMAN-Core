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
}
