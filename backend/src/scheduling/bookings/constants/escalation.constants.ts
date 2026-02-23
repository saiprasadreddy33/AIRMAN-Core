export const BOOKING_ESCALATION_QUEUE = 'booking-escalation';

export const ESCALATION_JOB_NAME = 'escalateBookingAssignment';

/** Default delay before running the escalation check (2 hours in ms) */
export const ESCALATION_DELAY_MS = 2 * 60 * 60 * 1000;

export const ESCALATION_MAX_ATTEMPTS = 3;
