import { Controller, Get, Param, Req, UseGuards, Post, Body, Patch, Delete, Query, ParseIntPipe, DefaultValuePipe, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

/**
 * JwtStrategy.validate() returns { user_id, role, tenant_id, email }
 * so request user object always uses user_id — never id.
 */
type AuthUser = { user: { user_id: string; tenant_id: string; role: string } };

@Controller('availability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AvailabilityController {
  constructor(private availability: AvailabilityService) {}

  /**
   * POST /availability
   * Instructors and admins create availability slots.
   * The authenticated user's ID is used as the instructor_id.
   */
  @Post()
  @Roles('instructor', 'admin')
  create(
    @Body() dto: CreateAvailabilityDto,
    @Req() req: AuthUser,
  ) {
    const startTime = new Date(dto.start_time);
    const endTime = new Date(dto.end_time);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new BadRequestException('Invalid date format for start_time or end_time');
    }

    // req.user.user_id is populated by JwtStrategy.validate()
    return this.availability.create(req.user.tenant_id, req.user.user_id, {
      start_time: startTime,
      end_time: endTime,
    });
  }

  /**
   * GET /availability
   * All authenticated roles can list availability slots.
   * Students need this to see slots when booking a session.
   */
  @Get()
  @Roles('admin', 'instructor', 'student')
  list(
    @Req() req: AuthUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('instructorId') instructorId?: string,
  ) {
    if (instructorId) {
      return this.availability.findByInstructor(req.user.tenant_id, instructorId, page, limit);
    }
    return this.availability.findByTenant(req.user.tenant_id, page, limit);
  }

  /**
   * GET /availability/instructor/:instructorId
   * Filter availability by a specific instructor — useful for booking forms.
   */
  @Get('instructor/:instructorId')
  @Roles('admin', 'instructor', 'student')
  byInstructor(
    @Param('instructorId') instructorId: string,
    @Req() req: AuthUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.availability.findByInstructor(req.user.tenant_id, instructorId, page, limit);
  }

  /**
   * PATCH /availability/:id
   * Instructors and admins can update their own slots.
   */
  @Patch(':id')
  @Roles('instructor', 'admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityDto,
    @Req() req: AuthUser,
  ) {
    const updateData: { start_time?: Date; end_time?: Date } = {};

    if (dto.start_time) {
      const startTime = new Date(dto.start_time);
      if (isNaN(startTime.getTime())) {
        throw new BadRequestException('Invalid date format for start_time');
      }
      updateData.start_time = startTime;
    }

    if (dto.end_time) {
      const endTime = new Date(dto.end_time);
      if (isNaN(endTime.getTime())) {
        throw new BadRequestException('Invalid date format for end_time');
      }
      updateData.end_time = endTime;
    }

    return this.availability.update(req.user.tenant_id, id, updateData);
  }

  /**
   * DELETE /availability/:id
   * Instructors and admins can remove their slots.
   */
  @Delete(':id')
  @Roles('instructor', 'admin')
  delete(
    @Param('id') id: string,
    @Req() req: AuthUser,
  ) {
    return this.availability.delete(req.user.tenant_id, id);
  }
}
