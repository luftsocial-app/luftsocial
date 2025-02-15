import { Module } from '@nestjs/common';
import { LinkedInMetricsCollectionJob } from './jobs/metrics-collection.job';
import { LinkedInTokenRefreshJob } from './jobs/token-refresh.job';
import { LinkedInService } from './linkedin.service';
import { LinkedInRepository } from './repositories/linkedin.repository';
import { LinkedInController } from './linkedin.controller';
import { LinkedInConfig } from './config/linkedin.config';

@Module({
  controllers: [LinkedInController],
  providers: [
    LinkedInService,
    LinkedInRepository,
    LinkedInMetricsCollectionJob,
    LinkedInConfig,
    LinkedInTokenRefreshJob,
  ],
  exports: [LinkedInService],
})
export class LinkedInModule {}
