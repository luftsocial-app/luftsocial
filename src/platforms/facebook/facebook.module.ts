import { Module } from '@nestjs/common';
import { FacebookPageMetricsJob } from './jobs/page_metrics-collection.job';
import { FacebookTokenRefreshJob } from './jobs/token-refresh.job';
import { FacebookController } from './facebook.controller';
import { FacebookRepository } from './repositories/facebook.repository';
import { FacebookPageInsightsJob } from './jobs/page-insight.job';
import { FacebookService } from './facebook.service';
import { FacebookPostMetricsJob } from './jobs/post-metrics-collection.job';

@Module({
  controllers: [FacebookController],
  providers: [
    FacebookService,
    FacebookRepository,
    FacebookPageMetricsJob,
    FacebookPostMetricsJob,
    FacebookTokenRefreshJob,
    FacebookPageInsightsJob,
  ],
  exports: [FacebookService],
})
export class FacebookModule {}
