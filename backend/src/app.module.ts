import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { BullConfigModule } from './bull/bull.module';
import { CacheModule } from './common/cache/cache.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TenantsModule } from './tenants/tenants.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { LearningModule } from './learning/learning.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { AuditLogsModule } from './audit-logs/audit-logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting – default limits; endpoints override with @Throttle()
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60_000, // 60 seconds window (ms)
        limit: 60,   // 60 req/min default (GET endpoints)
      },
    ]),
    PrismaModule,
    BullConfigModule,
    CacheModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    SchedulingModule,
    LearningModule,
    AuditLogsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // ThrottlerGuard must come after JwtAuthGuard so it can use request context
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule {}
