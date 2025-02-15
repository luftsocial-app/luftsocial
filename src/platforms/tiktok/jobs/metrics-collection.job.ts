import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TikTokRepository } from '../repositories/tiktok.repository';
import { TikTokService } from '../tiktok.service';

@Injectable()
export class TikTokMetricsCollectionJob {
  private readonly logger = new Logger(TikTokMetricsCollectionJob.name);

  constructor(
    private readonly tiktokRepo: TikTokRepository,
    private readonly tiktokService: TikTokService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async collectMetrics() {
    this.logger.log('Starting TikTok metrics collection job');

    try {
      const accounts = await this.tiktokRepo.getActiveAccounts();

      for (const account of accounts) {
        try {
          // Get recent videos
          const videos = await this.tiktokRepo.getRecentVideos(account.id);

          // Collect metrics for each video
          for (const video of videos) {
            try {
              const metrics = await this.tiktokService.getMetrics(
                account.id,
                video.id,
              );

              await this.tiktokRepo.createVideoMetrics({
                videoId: video.id,
                metrics,
              });

              this.logger.debug(`Collected metrics for video ${video.id}`);
            } catch (error) {
              this.logger.error(
                `Failed to collect metrics for video ${video.id}`,
                error.stack,
              );
            }
          }
        } catch (error) {
          this.logger.error(
            `Failed to process account ${account.id}`,
            error.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error('Metrics collection job failed', error.stack);
    }
  }
}
