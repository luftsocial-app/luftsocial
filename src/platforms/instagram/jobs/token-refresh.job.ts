import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InstagramRepository } from '../repositories/instagram.repository';
import { InstagramService } from '../instagram.service';

@Injectable()
export class InstagramTokenRefreshJob {
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
          await this.instagramService.refreshToken(account.id);
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
