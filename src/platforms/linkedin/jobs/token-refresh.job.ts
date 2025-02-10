import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LinkedInRepository } from '../repositories/linkedin.repository';
import { LinkedInService } from '../linkedin.service';

@Injectable()
export class LinkedInTokenRefreshJob {
  private readonly logger = new Logger(LinkedInTokenRefreshJob.name);

  constructor(
    private readonly linkedInRepo: LinkedInRepository,
    private readonly linkedInService: LinkedInService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async refreshExpiredTokens() {
    this.logger.log('Starting LinkedIn token refresh job');

    try {
      const accounts = await this.linkedInRepo.getAccountsNearingExpiration();

      for (const account of accounts) {
        try {
          const newTokens = await this.linkedInService.refreshToken(account.id);

          const tokens = {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            expiresAt: new Date(Date.now() + newTokens.expiresIn * 1000),
          };
          await this.linkedInRepo.updateAccountTokens(account.id, tokens);

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
