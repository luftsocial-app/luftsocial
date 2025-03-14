import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FacebookRepository } from '../repositories/facebook.repository';
import { FacebookService } from '../facebook.service';

@Injectable()
export class FacebookPageMetricsJob {
  private readonly logger = new Logger(FacebookPageMetricsJob.name);

  constructor(
    private readonly facebookRepo: FacebookRepository,
    private readonly facebookService: FacebookService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async collectPageMetrics() {
    try {
      const pages = await this.facebookRepo.getActivePages();

      for (const page of pages) {
        if (!page.facebookAccount) {
          this.logger.warn(
            `Skipping page ${page.id} as it has no associated account.`,
          );
          continue;
        }

        try {
          const metrics = await this.facebookService.getPageInsights(
            page.facebookAccount.id,
          );
          await this.facebookRepo.upsertPageMetrics({
            pageId: page.id,
            ...metrics,
          });
        } catch (error) {
          this.logger.error(
            `Failed to collect metrics for page ${page.id}`,
            error.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error('Page metrics collection job failed', error.stack);
    }
  }
}
