import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Request, Response } from 'express';
import { Observable, from } from 'rxjs';
import { concatMap, switchMap } from 'rxjs/operators';

type RequestUser = {
  user_id: string;
  tenant_id: string;
};

type AuditableRequest = Request & {
  user?: RequestUser;
  params?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
};

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);
  private readonly auditedMethods = new Set(['POST', 'PATCH', 'DELETE']);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuditableRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const action = request.method?.toUpperCase();

    if (!action || !this.auditedMethods.has(action)) {
      return next.handle();
    }

    const user = request.user;
    if (!user?.user_id || !user.tenant_id) {
      return next.handle();
    }

    const correlationId = this.getOrCreateCorrelationId(request, response);
    const entityType = this.resolveEntityType(request);
    const preEntityId = this.resolveEntityId(request, undefined);

    return from(this.getBeforeState(action, entityType, preEntityId, user.tenant_id)).pipe(
      switchMap((beforeState: unknown) =>
        next.handle().pipe(
          concatMap(async (afterState: unknown) => {
            const entityId = this.resolveEntityId(request, afterState);
            if (!entityType || !entityId) {
              return afterState;
            }

            const auditLogDelegate = (this.prisma as unknown as {
              auditLog?: { create: (args: unknown) => Promise<unknown> };
            }).auditLog;

            if (!auditLogDelegate?.create) {
              return afterState;
            }

            await auditLogDelegate.create({
              data: {
                tenant_id: user.tenant_id,
                user_id: user.user_id,
                action,
                entity_type: entityType,
                entity_id: entityId,
                before_state: this.toJsonValue(beforeState),
                after_state: this.toJsonValue(afterState),
                correlation_id: correlationId,
              },
            }).catch((error: unknown) => {
              this.logger.warn(
                `Failed to write audit log for ${action} ${entityType}:${entityId}`,
              );
              this.logger.debug(String(error));
            });

            return afterState;
          }),
        ),
      ),
    );
  }

  private getOrCreateCorrelationId(request: AuditableRequest, response: Response): string {
    const headerValue = request.headers['x-correlation-id'];
    const existing = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const correlationId = typeof existing === 'string' && existing.trim().length > 0
      ? existing.trim()
      : this.createCorrelationId();

    response.setHeader('x-correlation-id', correlationId);
    return correlationId;
  }

  private resolveEntityType(request: AuditableRequest): string | null {
    const rawPath = request.baseUrl || request.path || request.originalUrl || '';
    const [firstSegment] = rawPath
      .split('?')[0]
      .split('/')
      .filter(Boolean);

    if (!firstSegment) {
      return null;
    }

    const singular = firstSegment.endsWith('s')
      ? firstSegment.slice(0, -1)
      : firstSegment;

    return singular.charAt(0).toUpperCase() + singular.slice(1);
  }

  private resolveEntityId(
    request: AuditableRequest,
    afterState: unknown,
  ): string | null {
    const fromParams = request.params?.id;
    if (typeof fromParams === 'string' && fromParams.length > 0) {
      return fromParams;
    }

    const body = request.body;
    const fromBody = body?.entity_id;
    if (typeof fromBody === 'string' && fromBody.length > 0) {
      return fromBody;
    }

    const fromBodyId = body?.id;
    if (typeof fromBodyId === 'string' && fromBodyId.length > 0) {
      return fromBodyId;
    }

    if (afterState && typeof afterState === 'object' && !Array.isArray(afterState)) {
      const possibleId = (afterState as Record<string, unknown>).id;
      if (typeof possibleId === 'string' && possibleId.length > 0) {
        return possibleId;
      }
    }

    return null;
  }

  private async getBeforeState(
    action: string,
    entityType: string | null,
    entityId: string | null,
    tenantId: string,
  ): Promise<unknown> {
    if ((action !== 'PATCH' && action !== 'DELETE') || !entityType || !entityId) {
      return null;
    }

    const delegateName = entityType.charAt(0).toLowerCase() + entityType.slice(1);
    const delegate = (this.prisma as unknown as Record<string, unknown>)[delegateName] as
      | { findFirst?: (args: unknown) => Promise<unknown> }
      | undefined;

    if (!delegate?.findFirst) {
      return null;
    }

    try {
      return await delegate.findFirst({
        where: {
          id: entityId,
          tenant_id: tenantId,
        },
      });
    } catch {
      return null;
    }
  }

  private toJsonValue(value: unknown): unknown {
    if (value == null) {
      return null;
    }

    return JSON.parse(JSON.stringify(value)) as unknown;
  }

  private createCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).slice(2, 12);
    return `${timestamp}-${randomPart}`;
  }
}
