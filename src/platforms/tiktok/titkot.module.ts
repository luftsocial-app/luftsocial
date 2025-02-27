import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ScheduleModule } from '@nestjs/schedule';

// TikTok-specific imports
import { TikTokMetricsCollectionJob } from './jobs/metrics-collection.job';
import { TikTokController } from './tiktok.controller';
import { TikTokRepository } from './repositories/tiktok.repository';
import { TikTokService } from './tiktok.service';
import { TikTokConfig } from './config/tiktok.config';

// Shared imports
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialAccount } from '../entity/social-account.entity';
import { AuthState } from '../facebook/entity/auth-state.entity';

// TikTok entities
import { TikTokAccount } from './entities/tiktok-account.entity';
import { TikTokVideo } from './entities/tiktok-video.entity';
import { TikTokMetric } from './entities/tiktok-metric.entity';
import { TikTokComment } from './entities/tiktok_comments.entity';
import { TikTokRateLimit } from './entities/tiktok_rate_limits.entity';

// Repositories for other platforms
import { TikTokTokenRefreshJob } from './jobs/token-refresh.job';
import { DatabaseModule } from 'src/database/database.module';
import { MediaStorageModule } from 'src/media-storage/media-storage.module';
import { PlatformAuthModule } from 'src/platform-auth/platform-auth.module';

@Module({
  controllers: [TikTokController],
  imports: [
    // Enable scheduling for cron jobs
    ScheduleModule.forRoot(),

    MulterModule.register({
      dest: './uploads',
    }),
    ConfigModule,
    DatabaseModule,
    MediaStorageModule,
    PlatformAuthModule,
    TypeOrmModule.forFeature([
      TikTokAccount,
      TikTokVideo,
      TikTokMetric,
      TikTokRateLimit,
      TikTokComment,
      AuthState,
      SocialAccount,
    ]),
  ],
  providers: [
    TikTokService,
    TikTokRepository,
    TikTokMetricsCollectionJob,
    TikTokTokenRefreshJob,
    TikTokConfig,
  ],
  exports: [TikTokService],
})
export class TikTokModule {}
