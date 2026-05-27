import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import { Observable, tap } from 'rxjs';

import { AuditService } from '../../audit/audit.service';

@Injectable()
export class AuditInterceptor
  implements NestInterceptor
{
  constructor(
    private readonly auditService: AuditService,
  ) {}

  intercept(
    context: ExecutionContext,

    next: CallHandler,
  ): Observable<any> {
    const request =
      context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap(async () => {
        await this.auditService.createLog({
          userId: request.user?.id,

          action: `${request.method}_${request.route.path}`,

          method: request.method,

          endpoint: request.originalUrl,

          ipAddress: request.ip,

          payload: request.body,
        });
      }),
    );
  }
}