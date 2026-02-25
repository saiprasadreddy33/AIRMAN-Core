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
import { NotificationsService } from '../../notifications/notifications.service';
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

const USER_SELECT = { id: true, name: true, email: true };
const BOOKING_INCLUDE = {
  instructor: { select: USER_SELECT },
  student: { select: USER_SELECT },
};

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private notifications: NotificationsService,
    @InjectQueue(BOOKING_ESCALATION_QUEUE) private escalationQueue: Queue,
  ) {}

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

  private async hasInstructorAvailability(
    tenantId: string,
    instructorId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<boolean> {
    const availability = await this.prisma.instructorAvailability.findFirst({
      where: {
        tenant_id: tenantId,
        instructor_id: instructorId,
        start_time: { lte: startTime },
        end_time: { gte: endTime },
      },
    });
    return availability != null;
  }

  private validateTimeSlot(startTime: Date, endTime: Date) {
    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }
  }

  private async getBookingForUpdate(tenantId: string, id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private buildNotifyPayload(booking: {
    id: string; tenant_id: string; start_time: Date; end_time: Date;
    student?: { email: string; name?: string | null } | null;
    instructor?: { email: string; name?: string | null } | null;
  }) {
    return {
      bookingId: booking.id,
      tenantId: booking.tenant_id,
      studentEmail: booking.student?.email,
      studentName: booking.student?.name ?? undefined,
      instructorEmail: booking.instructor?.email,
      instructorName: booking.instructor?.name ?? undefined,
      startTime: booking.start_time.toISOString(),
      endTime: booking.end_time.toISOString(),
    };
  }

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
    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: toStatus, [timestampField]: new Date() },
      include: BOOKING_INCLUDE,
    });
    await this.cache.invalidateBookings(tenantId);
    await this.cache.invalidateAvailability(tenantId);
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

    if (!(await this.hasInstructorAvailability(tenantId, data.instructor_id, data.start_time, data.end_time))) {
      throw new BadRequestException('INSTRUCTOR_NOT_AVAILABLE');
    }

    if (await this.hasInstructorOverlap(tenantId, data.instructor_id, data.start_time, data.end_time)) {
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
      include: BOOKING_INCLUDE,
    });

    await this.cache.invalidateBookings(tenantId);
    await this.cache.invalidateAvailability(tenantId);
    this.notifications.notifyBookingRequested(this.buildNotifyPayload(booking));
    return booking;
  }

  async approveBooking(tenantId: string, id: string) {
    const booking = await this.transition(tenantId, id, BookingStatus.approved, 'approved_at');

    this.notifications.notifyBookingApproved(this.buildNotifyPayload(booking));

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
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false, // keep failed jobs for inspection
      },
    );

    return booking;
  }

  async assignInstructor(tenantId: string, id: string) {
    const booking = await this.transition(tenantId, id, BookingStatus.assigned, 'assigned_at');
    this.notifications.notifyBookingAssigned(this.buildNotifyPayload(booking));
    return booking;
  }

  async completeBooking(tenantId: string, id: string) {
    const booking = await this.transition(tenantId, id, BookingStatus.completed, 'completed_at');
    this.notifications.notifyBookingCompleted(this.buildNotifyPayload(booking));
    return booking;
  }

  async cancelBooking(tenantId: string, id: string) {
    const booking = await this.transition(tenantId, id, BookingStatus.cancelled, 'cancelled_at');
    this.notifications.notifyBookingCancelled(this.buildNotifyPayload(booking));
    return booking;
  }

  async findByTenant(
    tenantId: string,
    page = 1,
    limit = 50,
    userId?: string,
    role?: string,
  ) {
    const key = this.cache.bookingsKey(tenantId, page, limit);
    const cached = await this.cache.get<{ data: unknown[]; total: number; page: number; limit: number }>(key);
    if (cached) return cached;

    const roleFilter =
      role === 'student'
        ? { student_id: userId }
        : role === 'instructor'
          ? { instructor_id: userId }
          : {};

    const where = { tenant_id: tenantId, ...roleFilter };
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: { start_time: 'desc' },
        skip,
        take: limit,
        include: BOOKING_INCLUDE,
      }),
      this.prisma.booking.count({ where }),
    ]);

    const result = { data, total, page, limit };
    await this.cache.set(key, result);
    return result;
  }

  async findOne(tenantId: string, id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, tenant_id: tenantId },
      include: BOOKING_INCLUDE,
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }
}
