import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FacebookRepository } from '../repositories/facebook.repository';
import { FacebookService } from '../facebook.service';

@Injectable()
export class FacebookTokenRefreshJob {
  private readonly logger = new Logger(FacebookTokenRefreshJob.name);

  constructor(
    private readonly facebookRepo: FacebookRepository,
    private readonly facebookService: FacebookService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async refreshTokens() {
    try {
      const accounts = await this.facebookRepo.getAccountsWithExpiringTokens();

      for (const account of accounts) {
        try {
          const newToken = await this.facebookService.refreshLongLivedToken(
            account.longLivedToken,
          );

          await this.facebookRepo.updateAccount(account.id, {
            accessToken: newToken.access_token,
            tokenExpiresAt: new Date(Date.now() + newToken.expires_in * 1000),
          });

          // Refresh page tokens
          const pages = await this.facebookRepo.getAccountPages(account.id);
          for (const page of pages) {
            const newPageToken = await this.facebookService.refreshPageToken(
              page.pageId,
              newToken.access_token,
            );

            await this.facebookRepo.updatePageToken(
              page.id,
              newPageToken.access_token,
            );
          }
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
