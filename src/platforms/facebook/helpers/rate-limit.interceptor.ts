import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FacebookRepository } from '../repositories/facebook.repository';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(
    private readonly facebookRepo: FacebookRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RateLimitInterceptor.name);
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const pageId = request.params.pageId;

    if (pageId) {
      this.logger.info('Page_ID:', pageId);
      const canProceed = await this.checkRateLimit(pageId);
      if (!canProceed) {
        throw new HttpException(
          'Rate limit exceeded',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return next.handle();
  }

  private async checkRateLimit(pageId: string): Promise<boolean> {
    const page = await this.facebookRepo.getPageById(pageId);
    if (!page) return false;

    const hourlyLimit = 50; // Facebook's rate limit
    const recentPosts = await this.facebookRepo.getRecentPostCount(
      pageId,
      'hour',
    );

    return recentPosts < hourlyLimit;
  }
}
