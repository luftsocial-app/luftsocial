import { Module } from '@nestjs/common';
import { FacebookMetricsCollectionJob } from './jobs/metrics-collection.job';
import { FacebookTokenRefreshJob } from './jobs/token-refresh.job';
import { FacebookController } from './facebook.controller';
import { FacebookRepository } from './repositories/facebook.repository';
import { FacebookPageInsightsJob } from './jobs/page-insight.job';
import { FacebookService } from './facebook.service';

@Module({
  controllers: [FacebookController],
  providers: [
    FacebookService,
    FacebookRepository,
    FacebookMetricsCollectionJob,
    FacebookTokenRefreshJob,
    FacebookPageInsightsJob,
  ],
  exports: [FacebookService],
})
export class FacebookModule {}
