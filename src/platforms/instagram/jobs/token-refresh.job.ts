import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InstagramRepository } from '../repositories/instagram.repository';
import { InstagramService } from '../instagram.service';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class InstagramTokenRefreshJob {
  [x: string]: any;

  constructor(
    private readonly instagramRepo: InstagramRepository,
    private readonly instagramService: InstagramService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(InstagramTokenRefreshJob.name);
  }

  @Cron(CronExpression.EVERY_12_HOURS)
  async refreshTokens() {
    this.logger.info('Starting Instagram token refresh job');

    try {
      const expiredAccounts =
        await this.instagramRepo.getAccountsWithExpiringTokens();

      for (const account of expiredAccounts) {
        try {
          await this.PlatformAuthService.refreshToken(
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
