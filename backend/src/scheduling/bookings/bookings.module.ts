import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingEscalationProcessor } from './booking-escalation.processor';
import { BOOKING_ESCALATION_QUEUE } from './constants/escalation.constants';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: BOOKING_ESCALATION_QUEUE }),
    NotificationsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService, BookingEscalationProcessor],
  exports: [BookingsService],
})
export class BookingsModule {}
