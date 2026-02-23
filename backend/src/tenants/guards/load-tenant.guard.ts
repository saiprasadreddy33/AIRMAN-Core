import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { TenantsService } from '../tenants.service';

/**
 * Loads tenant by id from request params and sets request.resourceTenantId
 * so TenantGuard can reject when request.user.tenant_id !== resource.tenant_id.
 */
@Injectable()
export class LoadTenantGuard implements CanActivate {
  constructor(private tenants: TenantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ params: { id?: string }; resourceTenantId?: string }>();
    const id = request.params?.id;
    if (!id) {
      return true;
    }
    const tenant = await this.tenants.findOne(id);
    request.resourceTenantId = tenant.tenant_id;
    return true;
  }
}
