import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FacebookRepository } from '../repositories/facebook.repository';
import { FacebookService } from '../facebook.service';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class FacebookPostMetricsJob {
  constructor(
    private readonly facebookRepo: FacebookRepository,
    private readonly facebookService: FacebookService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(FacebookPostMetricsJob.name);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
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
