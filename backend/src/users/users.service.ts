import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByTenant(tenantId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenant_id: tenantId },
        select: {
          id: true,
          tenant_id: true,
          roleId: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          role: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where: { tenant_id: tenantId } }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenant_id: tenantId },
      select: {
        id: true,
        tenant_id: true,
        roleId: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        role: true,
        tenant: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async changeRole(tenantId: string, userId: string, roleName: string) {
    const role = await this.prisma.role.findFirst({
      where: { tenant_id: tenantId, name: roleName },
    });
    if (!role) throw new NotFoundException('Role not found');

    await this.findOne(userId, tenantId);

    return this.prisma.user.update({
      where: { id: userId, tenant_id: tenantId },
      data: { roleId: role.id },
      select: {
        id: true,
        tenant_id: true,
        roleId: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        role: true,
      }
    });
  }
}
