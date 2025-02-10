import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    console.log({ ips: req.ips, ip: req.ip, user: req.user });
    return req.ips.length ? { ip: req.ips[0], user: req.user } : req.ip; // individualize IP extraction to meet your own needs
  }
}
