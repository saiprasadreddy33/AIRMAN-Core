import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Use in TenantGuard to pass the resource's tenant_id for comparison.
 * Set via SetMetadata('resourceTenantId', value) or from request params/body.
 */
export const ResourceTenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.resourceTenantId;
  },
);
