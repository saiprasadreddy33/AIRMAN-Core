import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from './../../prisma/prisma.service';
import { CacheService } from './../../common/cache/cache.service';
import {
  BookingStatus,
  isAllowedTransition,
} from './booking-status.enum';
import {
  BOOKING_ESCALATION_QUEUE,
  ESCALATION_DELAY_MS,
  ESCALATION_JOB_NAME,
  ESCALATION_MAX_ATTEMPTS,
} from './constants/escalation.constants';

const CONFLICTING_STATUSES = ['approved', 'assigned'] as const;

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    @InjectQueue(BOOKING_ESCALATION_QUEUE) private escalationQueue: Queue,
  ) {}

  /**
   * Check for time overlap with existing bookings for the same instructor
   * where status is 'approved' or 'assigned'.
   */
  private async hasInstructorOverlap(
    tenantId: string,
    instructorId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string,
  ): Promise<boolean> {
    const existing = await this.prisma.booking.findFirst({
      where: {
        tenant_id: tenantId,
        instructor_id: instructorId,
        status: { in: [...CONFLICTING_STATUSES] },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        start_time: { lt: endTime },
        end_time: { gt: startTime },
      },
    });
    return existing != null;
  }

  /**
   * Validate that startTime is before endTime
   */
  private validateTimeSlot(startTime: Date, endTime: Date) {
    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }
  }

  /** Load booking by tenant and id; throw NotFoundException if not found. */
  private async getBookingForUpdate(tenantId: string, id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  /** Validate status transition and update booking with new status and timestamp. */
  private async transition(
    tenantId: string,
    id: string,
    toStatus: BookingStatus,
    timestampField: 'approved_at' | 'assigned_at' | 'completed_at' | 'cancelled_at',
  ) {
    const booking = await this.getBookingForUpdate(tenantId, id);
    if (!isAllowedTransition(booking.status, toStatus)) {
      throw new BadRequestException(
        `Invalid transition from status "${booking.status}" to "${toStatus}"`,
      );
    }
    const now = new Date();
    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: toStatus,
        [timestampField]: now,
      },
    });
    // Invalidate bookings cache for this tenant after any state change
    await this.cache.invalidateBookings(tenantId);
    return updated;
  }

  async create(
    tenantId: string,
    data: {
      instructor_id: string;
      student_id: string;
      start_time: Date;
      end_time: Date;
    },
  ) {
    this.validateTimeSlot(data.start_time, data.end_time);

    const overlap = await this.hasInstructorOverlap(
      tenantId,
      data.instructor_id,
      data.start_time,
      data.end_time,
    );
    if (overlap) {
      throw new ConflictException('INSTRUCTOR_ALREADY_BOOKED');
    }

    const booking = await this.prisma.booking.create({
      data: {
        tenant_id: tenantId,
        instructor_id: data.instructor_id,
        student_id: data.student_id,
        start_time: data.start_time,
        end_time: data.end_time,
        status: BookingStatus.requested,
        requested_at: new Date(),
      },
    });

    // Invalidate bookings cache on create
    await this.cache.invalidateBookings(tenantId);
    return booking;
  }

  async approveBooking(tenantId: string, id: string) {
    const booking = await this.transition(
      tenantId,
      id,
      BookingStatus.approved,
      'approved_at',
    );

    await this.escalationQueue.add(
      ESCALATION_JOB_NAME,
      {
        booking_id: booking.id,
        tenant_id: booking.tenant_id,
        approved_at: booking.approved_at?.toISOString() ?? new Date().toISOString(),
      },
      {
        delay: ESCALATION_DELAY_MS,
        attempts: ESCALATION_MAX_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    return booking;
  }

  async assignInstructor(tenantId: string, id: string) {
    return this.transition(tenantId, id, BookingStatus.assigned, 'assigned_at');
  }

  async completeBooking(tenantId: string, id: string) {
    return this.transition(tenantId, id, BookingStatus.completed, 'completed_at');
  }

  async cancelBooking(tenantId: string, id: string) {
    return this.transition(tenantId, id, BookingStatus.cancelled, 'cancelled_at');
  }

  async findByTenant(tenantId: string, page = 1, limit = 10) {
    const key = this.cache.bookingsKey(tenantId, page, limit);
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { tenant_id: tenantId },
        orderBy: { start_time: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({
        where: { tenant_id: tenantId },
      }),
    ]);

    const result = { data, total, page, limit };
    await this.cache.set(key, result);
    return result;
  }

  async findOne(tenantId: string, id: string) {
    return this.getBookingForUpdate(tenantId, id);
  }
}
