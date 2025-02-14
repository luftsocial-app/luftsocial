import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from '../database/tenant.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantService: TenantService) { }

  use(req: Request, res: Response, next: NextFunction) {
    const TenantId = req.headers['x-tenant-id'] as string;
    this.tenantService.setTenantId(TenantId);
    next();
  }
}
