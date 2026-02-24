import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  BOOKING_ESCALATION_QUEUE,
  ESCALATION_JOB_NAME,
} from './constants/escalation.constants';

export interface EscalateBookingAssignmentPayload {
  booking_id: string;
  tenant_id: string;
  approved_at: string; // ISO date string
}

const TERMINAL_STATUSES = ['assigned', 'completed', 'cancelled'] as const;

@Processor(BOOKING_ESCALATION_QUEUE, {
  concurrency: 1,
})
export class BookingEscalationProcessor extends WorkerHost {
  private readonly logger = new Logger(BookingEscalationProcessor.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<EscalateBookingAssignmentPayload, void, string>): Promise<void> {
    if (job.name !== ESCALATION_JOB_NAME) {
      return;
    }

    const { booking_id, tenant_id, approved_at } = job.data;

    const booking = await this.prisma.booking.findFirst({
      where: { id: booking_id, tenant_id },
      include: {
        student: { select: { id: true, name: true, email: true } },
        instructor: { select: { id: true, name: true, email: true } },
      },
    });

    if (!booking) {
      this.logger.warn(`Booking not found: ${booking_id} (tenant: ${tenant_id})`);
      return;
    }

    // If already moved past approval → no escalation needed
    const isTerminal = TERMINAL_STATUSES.includes(
      booking.status as (typeof TERMINAL_STATUSES)[number],
    );
    if (isTerminal) {
      this.logger.log(`Booking ${booking_id} is already ${booking.status} — escalation skipped`);
      return;
    }

    this.logger.warn(`ESCALATION triggered for booking ${booking_id} (approved_at: ${approved_at})`);

    // Mark escalation required
    await this.prisma.booking.update({
      where: { id: booking_id },
      data: { escalation_required: true },
    });

    // Fetch admin users for this tenant to notify
    const adminRole = await this.prisma.role.findFirst({
      where: { tenant_id, name: 'admin' },
    });
    const admins = adminRole
      ? await this.prisma.user.findMany({
          where: { tenant_id, roleId: adminRole.id },
          select: { email: true, name: true },
        })
      : [];

    const adminEmails = admins.map(a => a.email);

    // Send escalation notification stub
    this.notifications.notifyEscalation({
      bookingId: booking_id,
      tenantId: tenant_id,
      studentEmail: booking.student?.email,
      studentName: booking.student?.name ?? undefined,
      instructorEmail: booking.instructor?.email,
      instructorName: booking.instructor?.name ?? undefined,
      startTime: booking.start_time.toISOString(),
      endTime: booking.end_time.toISOString(),
      approvedAt: approved_at,
      adminEmails,
    });
  }

  /**
   * Dead-letter handler: log if the job exhausts all retries.
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<EscalateBookingAssignmentPayload>, error: Error) {
    this.logger.error(
      `[DEAD-LETTER] Escalation job ${job.id} for booking ${job.data?.booking_id} failed after ${job.attemptsMade} attempts: ${error.message}`,
      error.stack,
    );
  }
}
