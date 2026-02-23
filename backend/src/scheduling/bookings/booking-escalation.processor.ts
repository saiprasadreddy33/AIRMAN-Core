import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
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

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<EscalateBookingAssignmentPayload, void, string>): Promise<void> {
    if (job.name !== ESCALATION_JOB_NAME) {
      return;
    }

    const { booking_id, tenant_id } = job.data;

    const booking = await this.prisma.booking.findFirst({
      where: { id: booking_id, tenant_id },
    });

    if (!booking) {
      this.logger.warn(`Booking not found: ${booking_id} (tenant: ${tenant_id})`);
      return;
    }

    const isTerminal =
      TERMINAL_STATUSES.includes(booking.status as (typeof TERMINAL_STATUSES)[number]);

    if (isTerminal) {
      return;
    }

    this.logger.warn(
      'ESCALATION_REQUIRED: Instructor not assigned within SLA',
      { bookingId: booking_id, tenantId: tenant_id, status: booking.status },
    );

    await this.prisma.booking.updateMany({
      where: { id: booking_id, tenant_id },
      data: { escalation_required: true },
    });
  }
}
