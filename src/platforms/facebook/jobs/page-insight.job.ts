import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FacebookService } from '../facebook.service';
import { FacebookRepository } from '../repositories/facebook.repository';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class FacebookPageInsightsJob {
  constructor(
    private readonly facebookRepo: FacebookRepository,
    private readonly facebookService: FacebookService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(FacebookPageInsightsJob.name);
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
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
