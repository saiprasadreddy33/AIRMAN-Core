import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RESOURCE_TENANT_ID_KEY } from '../decorators/resource-tenant.decorator';

/**
 * Rejects request if request.user.tenant_id !== resource.tenant_id.
 * Resource tenant_id must be set via @ResourceTenant() on the handler or
 * by setting request.resourceTenantId in an interceptor/guard that runs before this.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const resourceTenantId = this.reflector.getAllAndOverride<string>(RESOURCE_TENANT_ID_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (resourceTenantId == null || resourceTenantId === '') {
      return true;
    }
    const request = context.switchToHttp().getRequest<{
      user?: { tenant_id?: string };
      resourceTenantId?: string;
    }>();
    const userTenantId = request.user?.tenant_id;
    const resourceTenant = request.resourceTenantId ?? resourceTenantId;
    if (userTenantId !== resourceTenant) {
      throw new ForbiddenException('Access denied: tenant mismatch');
    }
    return true;
  }
}
