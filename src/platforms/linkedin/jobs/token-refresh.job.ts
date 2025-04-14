import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LinkedInRepository } from '../repositories/linkedin.repository';
import { PlatformAuthService } from '../../../platform-auth/platform-auth.service';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class LinkedInTokenRefreshJob {
  constructor(
    private readonly linkedInRepo: LinkedInRepository,
    private readonly PlatformAuthService: PlatformAuthService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(LinkedInTokenRefreshJob.name);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async refreshExpiredTokens() {
    this.logger.info('Starting LinkedIn token refresh job');

    try {
      const accounts = await this.linkedInRepo.getAccountsNearingExpiration();

      for (const account of accounts) {
        try {
          await this.PlatformAuthService.refreshToken(
            SocialPlatform.LINKEDIN,
            account.id,
          );

          this.logger.debug(`Refreshed tokens for account ${account.id}`);
        } catch (error) {
          this.logger.error(
            `Failed to refresh tokens for account ${account.id}`,
            error.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error('Token refresh job failed', error.stack);
    }
  }
}
