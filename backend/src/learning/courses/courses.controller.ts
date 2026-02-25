import { Controller, Get, Post, Param, Query, Req, UseGuards, ParseIntPipe, DefaultValuePipe, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CoursesService } from './courses.service';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @Roles('admin', 'instructor')
  async create(
    @Req() req: { user: { tenant_id: string } },
    @Body() body: { title: string; description?: string },
  ) {
    return this.coursesService.create(req.user.tenant_id, body.title, body.description || '');
  }

  @Get()
  @Roles('admin', 'instructor', 'student')
  async findAll(
    @Req() req: { user: { tenant_id: string } },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.coursesService.findAll(req.user.tenant_id, page, limit, search);
  }

  /**
   * Dashboard endpoint: returns all courses the student has started/completed
   * with progress percentages. Single round-trip, no N+1.
   */
  @Get('my-progress')
  @Roles('student')
  async getMyProgress(
    @Req() req: { user: { tenant_id: string; user_id: string } },
  ) {
    return this.coursesService.findMyProgressSummary(req.user.tenant_id, req.user.user_id);
  }

  @Get(':id/modules')
  @Roles('admin', 'instructor', 'student')
  async findModules(
    @Param('id') id: string,
    @Req() req: { user: { tenant_id: string } },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.coursesService.findModulesByCourse(req.user.tenant_id, id, page, limit, search);
  }

  /**
   * Returns per-lesson and per-module completion progress for the calling student.
   * Tenant-scoped — cross-tenant reads are rejected at the service layer.
   */
  @Get(':id/progress')
  @Roles('student', 'admin', 'instructor')
  async getCourseProgress(
    @Param('id') id: string,
    @Req() req: { user: { tenant_id: string; user_id: string } },
  ) {
    return this.coursesService.findCourseProgress(req.user.tenant_id, id, req.user.user_id);
  }
}
