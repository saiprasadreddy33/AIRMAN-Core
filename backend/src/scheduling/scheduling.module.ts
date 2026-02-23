import { Module } from '@nestjs/common';
import { AvailabilityModule } from './availability/availability.module';
import { BookingsModule } from './bookings/bookings.module';

@Module({
  imports: [AvailabilityModule, BookingsModule],
  exports: [AvailabilityModule, BookingsModule],
})
export class SchedulingModule {}
