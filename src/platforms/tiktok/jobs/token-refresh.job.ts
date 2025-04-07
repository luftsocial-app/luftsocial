import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TikTokRepository } from '../repositories/tiktok.repository';
import { PlatformAuthService } from '../../../platform-auth/platform-auth.service';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class TikTokTokenRefreshJob {
  constructor(
    private readonly tiktokRepo: TikTokRepository,
    private readonly PlatformAuthService: PlatformAuthService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(TikTokTokenRefreshJob.name);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async refreshTokens() {
    this.logger.info('Starting TikTok token refresh job');

    try {
      // Get TikTok accounts with expiring tokens
      const accounts = await this.tiktokRepo.getAccountsWithExpiringTokens();

      for (const account of accounts) {
        try {
          // Use the new PlatformAuthService to refresh the token
          await this.PlatformAuthService.refreshToken(
            SocialPlatform.TIKTOK,
            account.id,
          );

          this.logger.debug(`Refreshed token for account ${account.id}`);
        } catch (error) {
          this.logger.error(
            `Failed to refresh token for account ${account.id}`,
            error.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error('Token refresh job failed', error.stack);
    }
  }
}
