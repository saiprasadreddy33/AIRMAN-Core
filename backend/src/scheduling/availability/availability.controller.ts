import { Controller, Get, Param, Req, UseGuards, Post, Body, Patch, Delete, Query, ParseIntPipe, DefaultValuePipe, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Controller('availability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AvailabilityController {
  constructor(private availability: AvailabilityService) {}

  @Post()
  @Roles('instructor', 'admin')
  create(
    @Body() dto: CreateAvailabilityDto,
    @Req() req: { user: { tenant_id: string; id: string } },
  ) {
    const startTime = new Date(dto.start_time);
    const endTime = new Date(dto.end_time);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new BadRequestException('Invalid date format for start_time or end_time');
    }

    return this.availability.create(req.user.tenant_id, req.user.id, {
      start_time: startTime,
      end_time: endTime,
    });
  }

  @Get()
  @Roles('admin', 'instructor')
  list(
    @Req() req: { user: { tenant_id: string } },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.availability.findByTenant(req.user.tenant_id, page, limit);
  }

  @Get('instructor/:instructorId')
  @Roles('admin', 'instructor', 'student')
  byInstructor(
    @Param('instructorId') _instructorId: string,
    @Req() req: { user: { tenant_id: string } },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.availability.findByInstructor(req.user.tenant_id, _instructorId, page, limit);
  }

  @Patch(':id')
  @Roles('instructor', 'admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityDto,
    @Req() req: { user: { tenant_id: string } },
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

  @Delete(':id')
  @Roles('instructor', 'admin')
  delete(
    @Param('id') id: string,
    @Req() req: { user: { tenant_id: string } },
  ) {
    return this.availability.delete(req.user.tenant_id, id);
  }
}
