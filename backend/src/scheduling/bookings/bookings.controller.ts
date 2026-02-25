import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';

type AuthUser = { user: { user_id: string; tenant_id: string; role: string } };

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private bookings: BookingsService) {}

  @Post()
  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  @Roles('student')
  create(
    @Body() dto: CreateBookingDto,
    @Req() req: AuthUser,
  ) {
    return this.bookings.create(req.user.tenant_id, {
      instructor_id: dto.instructor_id,
      student_id: req.user.user_id,
      start_time: new Date(dto.start_time),
      end_time: new Date(dto.end_time),
    });
  }

  @Get()
  @Roles('admin', 'instructor', 'student')
  list(
    @Req() req: AuthUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.bookings.findByTenant(
      req.user.tenant_id,
      page,
      limit,
      req.user.user_id,
      req.user.role,
    );
  }

  @Get(':id')
  @Roles('admin', 'instructor', 'student')
  getOne(
    @Param('id') id: string,
    @Req() req: AuthUser,
  ) {
    return this.bookings.findOne(req.user.tenant_id, id);
  }

  @Patch(':id/approve')
  @Roles('admin', 'instructor')
  approve(
    @Param('id') id: string,
    @Req() req: AuthUser,
  ) {
    return this.bookings.approveBooking(req.user.tenant_id, id);
  }

  @Patch(':id/assign')
  @Roles('admin', 'instructor')
  assign(
    @Param('id') id: string,
    @Req() req: AuthUser,
  ) {
    return this.bookings.assignInstructor(req.user.tenant_id, id);
  }

  @Patch(':id/complete')
  @Roles('admin', 'instructor')
  complete(
    @Param('id') id: string,
    @Req() req: AuthUser,
  ) {
    return this.bookings.completeBooking(req.user.tenant_id, id);
  }

  @Patch(':id/cancel')
  @Roles('admin', 'instructor', 'student')
  cancel(
    @Param('id') id: string,
    @Req() req: AuthUser,
  ) {
    return this.bookings.cancelBooking(req.user.tenant_id, id);
  }
}
