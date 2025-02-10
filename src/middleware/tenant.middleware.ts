import {
  Inject,
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantAwareRepository } from '../database/tenant-aware.repository';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    @Inject('TenantAwarePostRepository')
    private readonly tenantAwareRepository: TenantAwareRepository,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.auth?.orgId || req.auth?.userId; // Use orgId if available, else fallback to userId
    console.log({ req: req.auth });
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID is required');
    }
    this.tenantAwareRepository.setTenantId(tenantId);
    next();
  }
}
