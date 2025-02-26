import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly logger: PinoLogger) {}

  use(req: Request, res: Response, next: NextFunction) {
    const tenantId =
      (req.headers['X-TENANT-ID'] as string) ||
      (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      this.logger.warn('`x-tenant-id` not provided');
      req['tenantId'] = null;
      return next();
    }
    console.log({ tenantId });

    req['tenantId'] = tenantId;
    next();
  }
}
