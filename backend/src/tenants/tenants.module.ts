import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { LoadTenantGuard } from './guards/load-tenant.guard';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, LoadTenantGuard],
  exports: [TenantsService, LoadTenantGuard],
})
export class TenantsModule {}
