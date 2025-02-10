import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FacebookRepository } from '../repositories/facebook.repository';
import { FacebookService } from '../facebook.service';

@Injectable()
export class FacebookMetricsCollectionJob {
  private readonly logger = new Logger(FacebookMetricsCollectionJob.name);

  constructor(
    private readonly facebookRepo: FacebookRepository,
    private readonly facebookService: FacebookService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async collectMetrics() {
    try {
      const pages = await this.facebookRepo.getActivePages();

      for (const page of pages) {
        try {
          const posts = await this.facebookRepo.getPagePosts(page.id, 50);

          for (const post of posts) {
            try {
              const metrics = await this.facebookService.getMetrics(post.id);
              await this.facebookRepo.upsertMetrics({
                postId: post.id,
                ...metrics,
              });
            } catch (error) {
              this.logger.error(
                `Failed to collect metrics for post ${post.id}`,
                error.stack,
              );
            }
          }
        } catch (error) {
          this.logger.error(`Failed to process page ${page.id}`, error.stack);
        }
      }
    } catch (error) {
      this.logger.error('Metrics collection job failed', error.stack);
    }
  }
}
