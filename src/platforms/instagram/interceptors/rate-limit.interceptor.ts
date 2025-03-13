import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { InstagramRepository } from '../repositories/instagram.repository';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(private readonly instagramRepo: InstagramRepository) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const accountId = request.params.accountId;

    if (accountId) {
      const action = this.determineAction(request.method, request.path);
      const canProceed = await this.instagramRepo.checkRateLimit(
        accountId,
        action,
      );

      if (!canProceed) {
        throw new HttpException(
          'Rate limit exceeded',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      await this.instagramRepo.recordRateLimitUsage(accountId, action);
    }

    return next.handle();
  }

  private determineAction(
    method: string,
    path: string,
  ): 'API_CALLS' | 'POSTS' | 'COMMENTS' | 'MEDIA_UPLOAD' {
    if (path.includes('/media') && method === 'POST') {
      return 'POSTS';
    }
    if (path.includes('/comments') && method === 'POST') {
      return 'COMMENTS';
    }
    if (path.includes('/upload') && method === 'POST') {
      return 'MEDIA_UPLOAD';
    }
    return 'API_CALLS';
  }
}
