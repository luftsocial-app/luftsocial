import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InstagramRepository } from '../repositories/instagram.repository';
import { InstagramService } from '../instagram.service';

@Injectable()
export class InstagramMetricsCollectionJob {
  private readonly logger = new Logger(InstagramMetricsCollectionJob.name);

  constructor(
    private readonly instagramRepo: InstagramRepository,
    private readonly instagramService: InstagramService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async collectMetrics() {
    this.logger.log('Starting Instagram metrics collection job');

    try {
      const accounts = await this.instagramRepo.getActiveAccounts();

      for (const account of accounts) {
        try {
          // Get recent media
          const media = await this.instagramRepo.getRecentMedia(account.id);

          // Collect metrics for each media
          for (const item of media) {
            await this.instagramService.withRateLimit(
              account.id,
              'API_CALLS',
              async () => {
                const metrics = await this.instagramService.getMetrics(
                  account.id,
                  item.mediaId,
                );

                await this.instagramRepo.upsertMediaMetrics(item.id, metrics);
              },
            );
          }

          // Collect account-level insights
          const insights = await this.instagramService.getAccountInsights(
            account.id,
          );
          await this.instagramRepo.updateAccountMetrics(account.id, insights);

          this.logger.debug(`Collected metrics for account ${account.id}`);
        } catch (error) {
          this.logger.error(
            `Failed to collect metrics for account ${account.id}`,
            error.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error('Metrics collection job failed', error.stack);
    }
  }
}
