/**
 * Booking workflow statuses.
 * Allowed transitions:
 *   requested → approved | cancelled
 *   approved  → assigned | cancelled
 *   assigned  → completed | cancelled
 */
export enum BookingStatus {
  requested = 'requested',
  approved = 'approved',
  assigned = 'assigned',
  completed = 'completed',
  cancelled = 'cancelled',
}

const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.requested]: [BookingStatus.approved, BookingStatus.cancelled],
  [BookingStatus.approved]: [BookingStatus.assigned, BookingStatus.cancelled],
  [BookingStatus.assigned]: [BookingStatus.completed, BookingStatus.cancelled],
  [BookingStatus.completed]: [],
  [BookingStatus.cancelled]: [],
};

export function isAllowedTransition(
  from: string,
  to: BookingStatus,
): boolean {
  const fromStatus = from as BookingStatus;
  if (!Object.values(BookingStatus).includes(fromStatus)) {
    return false;
  }
  return ALLOWED_TRANSITIONS[fromStatus].includes(to);
}

export const BOOKING_STATUS_VALUES = Object.values(BookingStatus) as string[];
