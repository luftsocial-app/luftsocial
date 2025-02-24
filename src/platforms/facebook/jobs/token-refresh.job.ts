import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FacebookRepository } from '../repositories/facebook.repository';
import { FacebookService } from '../facebook.service';
import { SocialPlatform } from 'src/enum/social-platform.enum';
import { OAuth2Service } from 'src/platform-auth/platform-auth.service';

@Injectable()
export class FacebookTokenRefreshJob {
  private readonly logger = new Logger(FacebookTokenRefreshJob.name);

  constructor(
    private readonly facebookRepo: FacebookRepository,
    private readonly facebookService: FacebookService,
    private readonly oauth2Service: OAuth2Service,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async refreshTokens() {
    try {
      // Get accounts with expiring tokens
      const accounts = await this.facebookRepo.getAccountsWithExpiringTokens();

      for (const account of accounts) {
        try {
          // Use OAuth2Service to refresh the main token
          const refreshedTokens = await this.oauth2Service.refreshToken(
            SocialPlatform.FACEBOOK,
            account.id,
          );

          // Update account with new tokens
          await this.facebookRepo.updateAccount(account.id, {
            longLivedToken: refreshedTokens.accessToken,
            tokenExpiresAt: new Date(
              Date.now() + refreshedTokens.expiresIn * 1000,
            ),
          });

          // Refresh page tokens
          const pages = await this.facebookRepo.getAccountPages(account.id);
          for (const page of pages) {
            try {
              // Use Facebook service to get new page token
              const newPageToken = await this.facebookService.refreshPageToken(
                page.pageId,
                refreshedTokens.accessToken,
              );

              // Update page token
              await this.facebookRepo.updatePageToken(
                page.id,
                newPageToken.access_token,
              );
            } catch (pageError) {
              this.logger.error(
                `Failed to refresh page token for page ${page.id}`,
                pageError.stack,
              );
            }
          }

          this.logger.log(
            `Successfully refreshed tokens for account ${account.id}`,
          );
        } catch (accountError) {
          this.logger.error(
            `Failed to refresh tokens for account ${account.id}`,
            accountError.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error('Overall token refresh job failed', error.stack);
    }
  }
}
