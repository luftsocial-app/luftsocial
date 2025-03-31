import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  private readonly logger = new Logger(ThrottlerBehindProxyGuard.name);
  protected async getTracker(req: Record<string, any>): Promise<any> {
    this.logger.log({ ips: req.ips, ip: req.ip, user: req.user });
    return req.ips.length ? { ip: req.ips[0], user: req.user } : req.ip; // individualize IP extraction to meet your own needs
  }
}
