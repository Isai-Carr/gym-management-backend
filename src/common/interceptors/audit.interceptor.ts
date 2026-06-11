import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../audit/audit.service';

const SENSITIVE_FIELDS = new Set([
  'password', 'currentPassword', 'newPassword',
  'token', 'refreshToken', 'accessToken',
  'secret', 'pass', 'apiKey',
]);

function sanitize(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const clean: any = {};
  for (const key of Object.keys(obj)) {
    clean[key] = SENSITIVE_FIELDS.has(key) ? '[REDACTED]' : obj[key];
  }
  return clean;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap(async () => {
        try {
          await this.auditService.createLog({
            userId: request.user?.id,
            action: `${request.method}_${request.route?.path ?? request.url}`,
            method: request.method,
            endpoint: request.originalUrl,
            ipAddress: request.ip,
            payload: sanitize(request.body),
          });
        } catch (_) {
          // audit failure must never break the request
        }
      }),
    );
  }
}