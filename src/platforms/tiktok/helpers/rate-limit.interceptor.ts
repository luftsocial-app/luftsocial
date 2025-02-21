import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TikTokRepository } from '../repositories/tiktok.repository';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(private readonly tiktokRepo: TikTokRepository) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const accountId = request.params.accountId;

    if (accountId) {
      const action = this.determineAction(request.method, request.path);
      const canProceed = await this.tiktokRepo.checkRateLimit(
        accountId,
        action,
      );

      if (!canProceed) {
        throw new HttpException(
          'Rate limit exceeded',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      await this.tiktokRepo.recordRateLimitUsage(accountId, action);
    }

    return next.handle();
  }

  private determineAction(method: string, path: string): string {
    if (path.includes('/videos') && method === 'POST') {
      return 'VIDEO_UPLOAD';
    }
    if (path.includes('/comments') && method === 'POST') {
      return 'COMMENT_CREATE';
    }
    return 'API_CALL';
  }
}
