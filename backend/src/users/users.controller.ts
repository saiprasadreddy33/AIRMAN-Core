import { Controller, Get, Param, Req, UseGuards, Query, ParseIntPipe, DefaultValuePipe, Patch, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  @Roles('admin', 'instructor')
  async list(
    @Req() req: { user: { tenant_id: string } },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.users.findByTenant(req.user.tenant_id, page, limit);
  }

  @Get(':id')
  @Roles('admin', 'instructor')
  async getOne(
    @Param('id') id: string,
    @Req() req: { user: { tenant_id: string } },
  ) {
    return this.users.findOne(id, req.user.tenant_id);
  }

  @Patch(':id/role')
  @Roles('admin')
  async changeRole(
    @Req() req: { user: { tenant_id: string } },
    @Param('id') id: string,
    @Body('role') role: string,
  ) {
    return this.users.changeRole(req.user.tenant_id, id, role);
  }
}
