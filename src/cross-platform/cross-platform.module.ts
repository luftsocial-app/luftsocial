import { Module } from '@nestjs/common';
import { FacebookModule } from 'src/platforms/facebook/facebook.module';
import { InstagramModule } from 'src/platforms/instagram/instagram.module';
import { LinkedInModule } from 'src/platforms/linkedin/linkedin.module';
import { TikTokModule } from 'src/platforms/tiktok/titkot.module';
import { CrossPlatformService } from './cross-platform.service';
import { AnalyticsService } from './services/analytics.service';
import { ContentPublisherService } from './services/content-publisher.service';
import { SchedulerService } from './services/scheduler.service';
import { CrossPlatformController } from './cross-platform.controller';
@Module({
  imports: [FacebookModule, InstagramModule, LinkedInModule, TikTokModule],
  providers: [
    CrossPlatformService,
    ContentPublisherService,
    AnalyticsService,
    SchedulerService,
  ],
  controllers: [CrossPlatformController],
  exports: [CrossPlatformService],
})
export class CrossPlatformModule {}
