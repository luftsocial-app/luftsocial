import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InstagramRepository } from '../repositories/instagram.repository';
import { InstagramService } from '../instagram.service';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';

@Injectable()
export class InstagramTokenRefreshJob {
  [x: string]: any;
  private readonly logger = new Logger(InstagramTokenRefreshJob.name);

  constructor(
    private readonly instagramRepo: InstagramRepository,
    private readonly instagramService: InstagramService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async refreshTokens() {
    this.logger.log('Starting Instagram token refresh job');

    try {
      const expiredAccounts =
        await this.instagramRepo.getAccountsWithExpiringTokens();

      for (const account of expiredAccounts) {
        try {
          await this.oauth2Service.refreshToken(
            SocialPlatform.INSTAGRAM,
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
