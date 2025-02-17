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
import { FacebookService } from 'src/platforms/facebook/facebook.service';
import { InstagramService } from 'src/platforms/instagram/instagram.service';
import { LinkedInService } from 'src/platforms/linkedin/linkedin.service';
import { TikTokService } from 'src/platforms/tiktok/tiktok.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsRecord } from './entity/analytics.entity';
import { PublishRecord } from './entity/publish.entity';
import { ScheduledPost } from './entity/schedule.entity';

@Module({
  imports: [
    FacebookModule,
    InstagramModule,
    LinkedInModule,
    TikTokModule,
    TypeOrmModule.forFeature([PublishRecord, AnalyticsRecord, ScheduledPost]),
  ],
  providers: [
    // Core services
    {
      provide: CrossPlatformService,
      useFactory: (
        facebookService: FacebookService,
        instagramService: InstagramService,
        linkedInService: LinkedInService,
        tiktokService: TikTokService,
      ) => {
        return new CrossPlatformService(
          facebookService,
          instagramService,
          linkedInService,
          tiktokService,
        );
      },
      inject: [
        FacebookService,
        InstagramService,
        LinkedInService,
        TikTokService,
      ],
    },
    ContentPublisherService,
    AnalyticsService,
    SchedulerService,
  ],
  controllers: [CrossPlatformController],
  exports: [CrossPlatformService],
})
export class CrossPlatformModule {}
