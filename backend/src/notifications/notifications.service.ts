import { Injectable, Logger } from '@nestjs/common';

export interface NotifyBookingPayload {
  bookingId: string;
  tenantId: string;
  studentEmail?: string;
  studentName?: string;
  instructorEmail?: string;
  instructorName?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
}

export interface NotifyEscalationPayload extends NotifyBookingPayload {
  adminEmails: string[];
  approvedAt?: string;
}

/**
 * NotificationService — email notification stubs.
 * All methods log structured events to the console.
 * Replace the `this.logger.log` calls with a real mailer (e.g. Nodemailer, SendGrid)
 * when ready for production.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  notifyBookingRequested(payload: NotifyBookingPayload): void {
    this.logger.log({
      event: 'BOOKING_REQUESTED',
      to: payload.studentEmail,
      subject: '✈️ Booking Request Received',
      body: `Hi ${payload.studentName ?? 'Student'}, your flight training booking (ID: ${payload.bookingId}) has been received and is pending review.`,
      ...this.meta(payload),
    });
  }

  notifyBookingApproved(payload: NotifyBookingPayload): void {
    this.logger.log({
      event: 'BOOKING_APPROVED',
      to: [payload.studentEmail, payload.instructorEmail].filter(Boolean),
      subject: '✅ Booking Approved',
      body: `Booking ${payload.bookingId} has been approved. Session: ${payload.startTime} – ${payload.endTime}. Instructor: ${payload.instructorName ?? 'TBD'}.`,
      ...this.meta(payload),
    });
  }

  notifyBookingAssigned(payload: NotifyBookingPayload): void {
    this.logger.log({
      event: 'BOOKING_ASSIGNED',
      to: payload.studentEmail,
      subject: '👨‍✈️ Instructor Assigned',
      body: `Your instructor ${payload.instructorName ?? 'has been assigned'} for booking ${payload.bookingId} on ${payload.startTime}.`,
      ...this.meta(payload),
    });
  }

  notifyBookingCompleted(payload: NotifyBookingPayload): void {
    this.logger.log({
      event: 'BOOKING_COMPLETED',
      to: payload.studentEmail,
      subject: '🎉 Session Completed',
      body: `Your training session (${payload.bookingId}) has been marked as completed. Well done!`,
      ...this.meta(payload),
    });
  }

  notifyBookingCancelled(payload: NotifyBookingPayload): void {
    this.logger.log({
      event: 'BOOKING_CANCELLED',
      to: [payload.studentEmail, payload.instructorEmail].filter(Boolean),
      subject: '❌ Booking Cancelled',
      body: `Booking ${payload.bookingId} has been cancelled.`,
      ...this.meta(payload),
    });
  }

  notifyEscalation(payload: NotifyEscalationPayload): void {
    this.logger.warn({
      event: 'ESCALATION_REQUIRED',
      to: payload.adminEmails,
      subject: '⚠️ [ACTION REQUIRED] Booking Not Assigned Within SLA',
      body: `Booking ${payload.bookingId} was approved at ${payload.approvedAt ?? 'unknown'} but an instructor has not been assigned yet. Immediate attention required.`,
      ...this.meta(payload),
    });
  }

  private meta(payload: NotifyBookingPayload) {
    return {
      bookingId: payload.bookingId,
      tenantId: payload.tenantId,
      timestamp: new Date().toISOString(),
    };
  }
}
