export const BOOKING_ESCALATION_QUEUE = 'booking-escalation';

export const ESCALATION_JOB_NAME = 'escalateBookingAssignment';

/** Delay before running the escalation check — read from env ESCALATION_HOURS (default 2h) */
const hours = parseFloat(process.env.ESCALATION_HOURS ?? '2');
export const ESCALATION_DELAY_MS = Math.max(1, hours) * 60 * 60 * 1000;

export const ESCALATION_MAX_ATTEMPTS = 3;
