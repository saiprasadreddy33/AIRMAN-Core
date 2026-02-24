import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';

@Injectable()
export class AvailabilityService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /**
   * Validate that startTime is before endTime, and both are valid dates
   */
  private validateTimeSlot(startTime: Date, endTime: Date) {
    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }
  }

  /**
   * Check for time overlap with existing availability for the same instructor
   */
  private async hasInstructorOverlap(
    tenantId: string,
    instructorId: string,
    startTime: Date,
    endTime: Date,
    excludeAvailabilityId?: string,
  ): Promise<boolean> {
    const existing = await this.prisma.instructorAvailability.findFirst({
      where: {
        tenant_id: tenantId,
        instructor_id: instructorId,
        start_time: { lt: endTime },
        end_time: { gt: startTime },
        ...(excludeAvailabilityId ? { id: { not: excludeAvailabilityId } } : {}),
      },
    });
    return existing != null;
  }

  /**
   * Invalidate all availability caches for a tenant
   */
  private async invalidateAvailabilityCaches(tenantId: string) {
    // Invalidate tenant availability caches (various pages)
    for (let page = 1; page <= 10; page++) {
      await this.cache.invalidate(this.cache.availabilityKey(tenantId, page, 10));
    }
    // Note: instructor-specific caches would also need invalidation if needed
  }

  private readonly INSTRUCTOR_INCLUDE = {
    instructor: { select: { id: true, name: true, email: true } },
  };

  async create(
    tenantId: string,
    instructorId: string,
    data: {
      start_time: Date;
      end_time: Date;
    },
  ) {
    this.validateTimeSlot(data.start_time, data.end_time);

    const overlap = await this.hasInstructorOverlap(
      tenantId,
      instructorId,
      data.start_time,
      data.end_time,
    );

    if (overlap) {
      throw new ConflictException('TIME_SLOT_OVERLAPS_EXISTING_AVAILABILITY');
    }

    const availability = await this.prisma.instructorAvailability.create({
      data: {
        tenant_id: tenantId,
        instructor_id: instructorId,
        start_time: data.start_time,
        end_time: data.end_time,
      },
      include: this.INSTRUCTOR_INCLUDE,
    });

    await this.invalidateAvailabilityCaches(tenantId);
    return availability;
  }

  async update(
    tenantId: string,
    availabilityId: string,
    data: {
      start_time?: Date;
      end_time?: Date;
    },
  ) {
    const existing = await this.prisma.instructorAvailability.findFirst({
      where: { id: availabilityId, tenant_id: tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Availability slot not found');
    }

    const startTime = data.start_time ?? existing.start_time;
    const endTime = data.end_time ?? existing.end_time;

    this.validateTimeSlot(startTime, endTime);

    const overlap = await this.hasInstructorOverlap(
      tenantId,
      existing.instructor_id,
      startTime,
      endTime,
      availabilityId,
    );

    if (overlap) {
      throw new ConflictException('TIME_SLOT_OVERLAPS_EXISTING_AVAILABILITY');
    }

    const updated = await this.prisma.instructorAvailability.update({
      where: { id: availabilityId },
      data: {
        start_time: startTime,
        end_time: endTime,
      },
    });

    await this.invalidateAvailabilityCaches(tenantId);
    return updated;
  }

  async delete(tenantId: string, availabilityId: string) {
    const existing = await this.prisma.instructorAvailability.findFirst({
      where: { id: availabilityId, tenant_id: tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Availability slot not found');
    }

    await this.prisma.instructorAvailability.delete({
      where: { id: availabilityId },
    });

    await this.invalidateAvailabilityCaches(tenantId);
  }

  async findByTenant(tenantId: string, page = 1, limit = 10) {
    const key = this.cache.availabilityKey(tenantId, page, limit);
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.instructorAvailability.findMany({
        where: { tenant_id: tenantId },
        orderBy: [{ start_time: 'asc' }],
        skip,
        take: limit,
        include: this.INSTRUCTOR_INCLUDE,
      }),
      this.prisma.instructorAvailability.count({
        where: { tenant_id: tenantId },
      }),
    ]);

    const result = { data, total, page, limit };
    await this.cache.set(key, result);
    return result;
  }

  async findByInstructor(tenantId: string, instructorId: string, page = 1, limit = 10) {
    const key = this.cache.availabilityByInstructorKey(tenantId, instructorId, page, limit);
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.instructorAvailability.findMany({
        where: { tenant_id: tenantId, instructor_id: instructorId },
        orderBy: [{ start_time: 'asc' }],
        skip,
        take: limit,
        include: this.INSTRUCTOR_INCLUDE,
      }),
      this.prisma.instructorAvailability.count({
        where: { tenant_id: tenantId, instructor_id: instructorId },
      }),
    ]);

    const result = { data, total, page, limit };
    await this.cache.set(key, result);
    return result;
  }
}
