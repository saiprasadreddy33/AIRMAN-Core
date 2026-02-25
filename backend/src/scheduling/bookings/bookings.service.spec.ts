import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { BookingsService } from './bookings.service';
import { BOOKING_ESCALATION_QUEUE } from './constants/escalation.constants';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: {
    booking: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    instructorAvailability: { findFirst: jest.Mock };
  };

  const tenantId = '11111111-1111-1111-1111-111111111111';
  const instructorId = '22222222-2222-2222-2222-222222222222';
  const studentId = '33333333-3333-3333-3333-333333333333';
  const bookingId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const start1 = new Date('2025-03-01T10:00:00Z');
  const end1 = new Date('2025-03-01T11:00:00Z');
  const start2 = new Date('2025-03-01T10:30:00Z'); // overlaps with 10-11
  const end2 = new Date('2025-03-01T11:30:00Z');

  const makeBooking = (status: string) => ({
    id: bookingId,
    tenant_id: tenantId,
    instructor_id: instructorId,
    student_id: studentId,
    start_time: start1,
    end_time: end1,
    status,
    requested_at: new Date(),
    approved_at: status !== 'requested' ? new Date() : null,
    assigned_at: status === 'assigned' || status === 'completed' ? new Date() : null,
    completed_at: status === 'completed' ? new Date() : null,
    cancelled_at: status === 'cancelled' ? new Date() : null,
    escalation_required: false,
    instructor: { id: instructorId, name: 'Instructor', email: 'instructor@test.com' },
    student: { id: studentId, name: 'Student', email: 'student@test.com' },
  });

  beforeEach(async () => {
    const findFirst = jest.fn();
    const create = jest.fn();
    const update = jest.fn();
    const availabilityFindFirst = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: PrismaService,
          useValue: {
            booking: { findFirst, create, update },
            instructorAvailability: { findFirst: availabilityFindFirst },
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            bookingsKey: jest.fn().mockReturnValue('key'),
            invalidateBookings: jest.fn().mockResolvedValue(undefined),
            invalidateAvailability: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            notifyBookingRequested: jest.fn(),
            notifyBookingApproved: jest.fn(),
            notifyBookingAssigned: jest.fn(),
            notifyBookingCompleted: jest.fn(),
            notifyBookingCancelled: jest.fn(),
            notifyEscalation: jest.fn(),
          },
        },
        {
          provide: getQueueToken(BOOKING_ESCALATION_QUEUE),
          useValue: { add: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = module.get(BookingsService);
    prisma = module.get(PrismaService) as unknown as typeof prisma;
  });

  // ── create ─────────────────────────────────────────────────────────────────

  it('should create first booking when no overlap', async () => {
    prisma.instructorAvailability.findFirst.mockResolvedValue({});
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.booking.create.mockResolvedValue(makeBooking('requested'));

    const result = await service.create(tenantId, {
      instructor_id: instructorId,
      student_id: studentId,
      start_time: start1,
      end_time: end1,
    });

    expect(result).toBeDefined();
    expect(prisma.booking.findFirst).toHaveBeenCalledWith({
      where: {
        tenant_id: tenantId,
        instructor_id: instructorId,
        status: { in: ['approved', 'assigned'] },
        start_time: { lt: end1 },
        end_time: { gt: start1 },
      },
    });
    expect(prisma.booking.create).toHaveBeenCalled();
  });

  it('should throw ConflictException (INSTRUCTOR_ALREADY_BOOKED) on instructor double-book attempt', async () => {
    prisma.instructorAvailability.findFirst.mockResolvedValue({});
    prisma.booking.findFirst.mockResolvedValueOnce(null);
    prisma.booking.create.mockResolvedValue(makeBooking('requested'));

    await service.create(tenantId, {
      instructor_id: instructorId,
      student_id: studentId,
      start_time: start1,
      end_time: end1,
    });

    prisma.booking.findFirst.mockResolvedValueOnce(makeBooking('approved'));

    await expect(
      service.create(tenantId, {
        instructor_id: instructorId,
        student_id: studentId,
        start_time: start2,
        end_time: end2,
      }),
    ).rejects.toThrow(ConflictException);

    expect(prisma.booking.create).toHaveBeenCalledTimes(1);
  });

  it('should throw ConflictException when instructor has no availability for requested slot', async () => {
    prisma.instructorAvailability.findFirst.mockResolvedValue(null);

    await expect(
      service.create(tenantId, {
        instructor_id: instructorId,
        student_id: studentId,
        start_time: start1,
        end_time: end1,
      }),
    ).rejects.toThrow('INSTRUCTOR_NOT_AVAILABLE');
  });

  // ── approve ────────────────────────────────────────────────────────────────

  it('should approve a requested booking', async () => {
    prisma.booking.findFirst.mockResolvedValue(makeBooking('requested'));
    prisma.booking.update.mockResolvedValue(makeBooking('approved'));

    const result = await service.approveBooking(tenantId, bookingId);

    expect(result.status).toBe('approved');
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: bookingId },
        data: expect.objectContaining({ status: 'approved' }),
      }),
    );
  });

  it('should throw BadRequestException when approving a non-requested booking', async () => {
    prisma.booking.findFirst.mockResolvedValue(makeBooking('approved'));

    await expect(service.approveBooking(tenantId, bookingId)).rejects.toThrow(BadRequestException);
  });

  // ── assign ─────────────────────────────────────────────────────────────────

  it('should assign an approved booking', async () => {
    prisma.booking.findFirst.mockResolvedValue(makeBooking('approved'));
    prisma.booking.update.mockResolvedValue(makeBooking('assigned'));

    const result = await service.assignInstructor(tenantId, bookingId);

    expect(result.status).toBe('assigned');
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: bookingId },
        data: expect.objectContaining({ status: 'assigned' }),
      }),
    );
  });

  it('should throw BadRequestException when assigning a non-approved booking', async () => {
    prisma.booking.findFirst.mockResolvedValue(makeBooking('requested'));

    await expect(service.assignInstructor(tenantId, bookingId)).rejects.toThrow(BadRequestException);
  });

  // ── complete ───────────────────────────────────────────────────────────────

  it('should complete an assigned booking', async () => {
    prisma.booking.findFirst.mockResolvedValue(makeBooking('assigned'));
    prisma.booking.update.mockResolvedValue(makeBooking('completed'));

    const result = await service.completeBooking(tenantId, bookingId);

    expect(result.status).toBe('completed');
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: bookingId },
        data: expect.objectContaining({ status: 'completed' }),
      }),
    );
  });

  it('should throw BadRequestException when completing a non-assigned booking', async () => {
    prisma.booking.findFirst.mockResolvedValue(makeBooking('requested'));

    await expect(service.completeBooking(tenantId, bookingId)).rejects.toThrow(BadRequestException);
  });

  // ── cancel ─────────────────────────────────────────────────────────────────

  it('should cancel a requested booking', async () => {
    prisma.booking.findFirst.mockResolvedValue(makeBooking('requested'));
    prisma.booking.update.mockResolvedValue(makeBooking('cancelled'));

    const result = await service.cancelBooking(tenantId, bookingId);

    expect(result.status).toBe('cancelled');
  });

  it('should cancel an approved booking', async () => {
    prisma.booking.findFirst.mockResolvedValue(makeBooking('approved'));
    prisma.booking.update.mockResolvedValue(makeBooking('cancelled'));

    const result = await service.cancelBooking(tenantId, bookingId);

    expect(result.status).toBe('cancelled');
  });

  it('should cancel an assigned booking', async () => {
    prisma.booking.findFirst.mockResolvedValue(makeBooking('assigned'));
    prisma.booking.update.mockResolvedValue(makeBooking('cancelled'));

    const result = await service.cancelBooking(tenantId, bookingId);

    expect(result.status).toBe('cancelled');
  });

  it('should throw BadRequestException when cancelling an already-completed booking', async () => {
    prisma.booking.findFirst.mockResolvedValue(makeBooking('completed'));

    await expect(service.cancelBooking(tenantId, bookingId)).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException when cancelling an already-cancelled booking', async () => {
    prisma.booking.findFirst.mockResolvedValue(makeBooking('cancelled'));

    await expect(service.cancelBooking(tenantId, bookingId)).rejects.toThrow(BadRequestException);
  });

  // ── invalid transitions ────────────────────────────────────────────────────

  it('should throw BadRequestException for complete → approve (backwards transition)', async () => {
    prisma.booking.findFirst.mockResolvedValue(makeBooking('completed'));

    await expect(service.approveBooking(tenantId, bookingId)).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException for assigned → request (backwards transition)', async () => {
    // requestBooking doesn't exist as a method — attempt approve of assigned
    prisma.booking.findFirst.mockResolvedValue(makeBooking('assigned'));

    await expect(service.approveBooking(tenantId, bookingId)).rejects.toThrow(BadRequestException);
  });
});
