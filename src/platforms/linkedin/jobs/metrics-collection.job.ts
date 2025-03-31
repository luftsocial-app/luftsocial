import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LinkedInRepository } from '../repositories/linkedin.repository';
import { LinkedInService } from '../linkedin.service';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class LinkedInMetricsCollectionJob {
  constructor(
    private readonly linkedInRepo: LinkedInRepository,
    private readonly linkedInService: LinkedInService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(LinkedInMetricsCollectionJob.name);
  }

  @Cron(CronExpression.EVERY_12_HOURS)
  async collectMetrics() {
    this.logger.info('Starting LinkedIn metrics collection job');

    try {
      const organizations = await this.linkedInRepo.getActiveOrganizations();

      for (const org of organizations) {
        try {
          const posts = await this.linkedInRepo.getRecentPosts(org.id);

          for (const post of posts) {
            try {
              const metrics = await this.linkedInService.getPostMetrics(
                org.id,
                post.postId,
              );

              await this.linkedInRepo.upsertMetrics(post.id, metrics);
              this.logger.debug(`Collected metrics for post ${post.postId}`);
            } catch (error) {
              this.logger.error(
                `Failed to collect metrics for post ${post.postId}`,
                error.stack,
              );
            }
          }
        } catch (error) {
          this.logger.error(
            `Failed to process organization ${org.id}`,
            error.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error('Metrics collection job failed', error.stack);
    }
  }
}
