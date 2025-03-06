import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TikTokRepository } from '../repositories/tiktok.repository';
import { OAuth2Service } from '../../../platform-auth/platform-auth.service';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';

@Injectable()
export class TikTokTokenRefreshJob {
  private readonly logger = new Logger(TikTokTokenRefreshJob.name);

  constructor(
    private readonly tiktokRepo: TikTokRepository,
    private readonly oauth2Service: OAuth2Service,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async refreshTokens() {
    this.logger.log('Starting TikTok token refresh job');

    try {
      // Get TikTok accounts with expiring tokens
      const accounts = await this.tiktokRepo.getAccountsWithExpiringTokens();

      for (const account of accounts) {
        try {
          // Use the new OAuth2Service to refresh the token
          await this.oauth2Service.refreshToken(
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
