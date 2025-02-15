import { Module } from '@nestjs/common';
import { ContentPublisherService } from './services/content-publisher.service';
import { AnalyticsService } from './services/analytics.service';
import { ContentOptimizationService } from './services/content-optimization.service';
import { SchedulerService } from './services/scheduler.service';
import { ContentPublisherRepository } from './repositories/content-publisher.repository';
import { AnalyticsRepository } from './repositories/analytics.repository';
import { ContentOptimizationRepository } from './repositories/content-optimization.repository';

@Module({
  providers: [
    ContentPublisherService,
    AnalyticsService,
    ContentOptimizationService,
    SchedulerService,
    ContentPublisherRepository,
    AnalyticsRepository,
    ContentOptimizationRepository,
  ],
  exports: [
    ContentPublisherService,
    AnalyticsService,
    ContentOptimizationService,
  ],
})
export class CrossPlatformModule {}
