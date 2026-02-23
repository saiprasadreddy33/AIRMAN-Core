import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingsService } from './bookings.service';
import { BOOKING_ESCALATION_QUEUE } from './constants/escalation.constants';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: { booking: { findFirst: jest.Mock; create: jest.Mock } };

  const tenantId = '11111111-1111-1111-1111-111111111111';
  const instructorId = '22222222-2222-2222-2222-222222222222';
  const studentId = '33333333-3333-3333-3333-333333333333';
  const start1 = new Date('2025-03-01T10:00:00Z');
  const end1 = new Date('2025-03-01T11:00:00Z');
  const start2 = new Date('2025-03-01T10:30:00Z'); // overlaps with 10-11
  const end2 = new Date('2025-03-01T11:30:00Z');

  const existingBooking = {
    id: 'existing-booking-id',
    tenant_id: tenantId,
    instructor_id: instructorId,
    student_id: studentId,
    start_time: start1,
    end_time: end1,
    status: 'approved',
    requested_at: new Date(),
    approved_at: new Date(),
    assigned_at: null,
    completed_at: null,
    cancelled_at: null,
  };

  beforeEach(async () => {
    const findFirst = jest.fn();
    const create = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: PrismaService,
          useValue: {
            booking: {
              findFirst,
              create,
            },
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

  it('should create first booking when no overlap', async () => {
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.booking.create.mockResolvedValue({
      ...existingBooking,
      id: 'new-booking-id',
      status: 'requested',
    });

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
    prisma.booking.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingBooking);
    prisma.booking.create.mockResolvedValue({
      ...existingBooking,
      id: 'first-booking-id',
      status: 'requested',
    });

    await service.create(tenantId, {
      instructor_id: instructorId,
      student_id: studentId,
      start_time: start1,
      end_time: end1,
    });

    await expect(
      service.create(tenantId, {
        instructor_id: instructorId,
        student_id: studentId,
        start_time: start2,
        end_time: end2,
      }),
    ).rejects.toThrow(ConflictException);

    await expect(
      service.create(tenantId, {
        instructor_id: instructorId,
        student_id: studentId,
        start_time: start2,
        end_time: end2,
      }),
    ).rejects.toMatchObject({
      response: { message: 'INSTRUCTOR_ALREADY_BOOKED' },
    });

    expect(prisma.booking.create).toHaveBeenCalledTimes(1);
  });
});
