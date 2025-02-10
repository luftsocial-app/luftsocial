// src/platforms/linkedin/linkedin.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LinkedInRepository } from './repositories/linkedin.repository';
import { LinkedInTokenRefreshJob } from './jobs/token-refresh.job';
import { LinkedInMetricsCollectionJob } from './jobs/metrics-collection.job';
import { LinkedInConfig } from './config/linkedin.config';
import { LinkedInService } from './linkedin.service';
import { LinkedInController } from './linkedin.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    LinkedInService,
    LinkedInRepository,
    LinkedInConfig,
    LinkedInTokenRefreshJob,
    LinkedInMetricsCollectionJob,
  ],
  controllers: [LinkedInController],
  exports: [LinkedInService],
})
export class LinkedInModule {}
