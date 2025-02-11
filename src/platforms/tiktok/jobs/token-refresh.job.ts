import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TikTokRepository } from '../repositories/tiktok.repository';
import { TikTokService } from '../tiktok.service';

@Injectable()
export class TikTokTokenRefreshJob {
  private readonly logger = new Logger(TikTokTokenRefreshJob.name);

  constructor(
    private readonly tiktokRepo: TikTokRepository,
    private readonly tiktokService: TikTokService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async refreshTokens() {
    this.logger.log('Starting TikTok token refresh job');

    try {
      const accounts = await this.tiktokRepo.getAccountsWithExpiringTokens();

      for (const account of accounts) {
        try {
          await this.tiktokService.refreshToken(account.id);
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
