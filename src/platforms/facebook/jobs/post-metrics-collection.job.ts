import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FacebookRepository } from '../repositories/facebook.repository';
import { FacebookService } from '../facebook.service';

@Injectable()
export class FacebookPostMetricsJob {
  private readonly logger = new Logger(FacebookPostMetricsJob.name);

  constructor(
    private readonly facebookRepo: FacebookRepository,
    private readonly facebookService: FacebookService,
  ) {}

  @Cron(CronExpression.EVERY_12_HOURS)
  async collectPostMetrics() {
    try {
      // Get all posts that need metrics update
      const posts = await this.facebookRepo.getRecentPosts();

      await Promise.all(
        posts.map(async (post) => {
          try {
            if (!post.account) {
              this.logger.warn(
                `Skipping post ${post.id} as it has no associated account.`,
              );
              return;
            }

            const metrics = await this.facebookService.getPostMetrics(
              post.account.id,
              post.id,
            );

            await this.facebookRepo.upsertPostMetrics({
              postId: post.id,
              metrics,
            });
            this.logger.debug(`Collected metrics for post ${post.id}`);
          } catch (error) {
            this.logger.error(
              `Failed to collect metrics for post ${post.id}`,
              error.stack,
            );
          }
        }),
      );
    } catch (error) {
      this.logger.error('Post metrics collection job failed', error.stack);
    }
  }
}
