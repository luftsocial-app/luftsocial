import { Module } from '@nestjs/common';
import { FacebookModule } from '../platforms/facebook/facebook.module';
import { InstagramModule } from '../platforms/instagram/instagram.module';
import { LinkedInModule } from '../platforms/linkedin/linkedin.module';
import { TikTokModule } from '../platforms/tiktok/titkot.module';
import { CrossPlatformService } from './cross-platform.service';
import { AnalyticsService } from './services/analytics.service';
import { ContentPublisherService } from './services/content-publisher.service';
import { SchedulerService } from './services/scheduler.service';
import { CrossPlatformController } from './cross-platform.controller';
import { FacebookService } from '../platforms/facebook/facebook.service';
import { InstagramService } from '../platforms/instagram/instagram.service';
import { LinkedInService } from '../platforms/linkedin/linkedin.service';
import { TikTokService } from '../platforms/tiktok/tiktok.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsRecord } from './entities/analytics.entity';
import { PublishRecord } from './entities/publish.entity';
import { ScheduledPost } from './entities/schedule.entity';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MediaStorageModule } from '../asset-management/media-storage/media-storage.module';
import { PinoLogger } from 'nestjs-pino';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
    }),
    FacebookModule,
    InstagramModule,
    LinkedInModule,
    MediaStorageModule,
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
          new PinoLogger({
            pinoHttp: { level: 'info' },
            renameContext: 'CrossPlatformService',
          }),
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
    MediaStorageModule,
  ],
  controllers: [CrossPlatformController],
  exports: [CrossPlatformService],
})
export class CrossPlatformModule {}
