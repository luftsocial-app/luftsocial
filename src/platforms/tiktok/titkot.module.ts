import { Module } from '@nestjs/common';
import { TikTokMetricsCollectionJob } from './jobs/metrics-collection.job';
import { TikTokTokenRefreshJob } from './jobs/token-refresh.job';
import { TikTokController } from './TikTok.controller';
import { TikTokRepository } from './repositories/TikTok.repository';
import { TikTokService } from './TikTok.service';

@Module({
  controllers: [TikTokController],
  providers: [
    TikTokService,
    TikTokRepository,
    TikTokMetricsCollectionJob,
    TikTokTokenRefreshJob,
  ],
  exports: [TikTokService],
})
export class TikTokModule {}
