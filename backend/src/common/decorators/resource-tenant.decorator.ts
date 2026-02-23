import { SetMetadata } from '@nestjs/common';

export const RESOURCE_TENANT_ID_KEY = 'resourceTenantId';

/**
 * Set the resource's tenant_id for TenantGuard. Use when the tenant_id
 * is known at handler level (e.g. from a route param).
 */
export const ResourceTenant = (tenantId: string) =>
  SetMetadata(RESOURCE_TENANT_ID_KEY, tenantId);
