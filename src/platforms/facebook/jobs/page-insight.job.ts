import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FacebookService } from '../facebook.service';
import { FacebookRepository } from '../repositories/facebook.repository';

@Injectable()
export class FacebookPageInsightsJob {
  private readonly logger = new Logger(FacebookPageInsightsJob.name);

  constructor(
    private readonly facebookRepo: FacebookRepository,
    private readonly facebookService: FacebookService,
  ) {}

  @Cron(CronExpression.EVERY_12_HOURS)
  async collectPageInsights() {
    try {
      const pages = await this.facebookRepo.getActivePages();

      for (const page of pages) {
        try {
          const insights = await this.facebookService.getPageInsights(page.id);

          await this.facebookRepo.updatePageMetrics(page.id, insights);
        } catch (error) {
          this.logger.error(
            `Failed to collect insights for page ${page.id}`,
            error.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error('Page insights collection failed', error.stack);
    }
  }
}
