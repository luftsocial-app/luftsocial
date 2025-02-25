import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from '../database/tenant.service';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private tenantService: TenantService,
    private readonly logger: PinoLogger,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const tenantId =
      (req.headers['X-TENANT-ID'] as string) ||
      (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      this.logger.warn('`X-TENANT-ID` not provided');
      req['tenantId'] = null;
      return next();
    }
    this.tenantService.setTenantId(tenantId);
    req['tenantId'] = tenantId;
    next();
  }
}
