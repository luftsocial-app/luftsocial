import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TikTokMetricsCollectionJob } from './jobs/metrics-collection.job';
import { TikTokTokenRefreshJob } from './jobs/token-refresh.job';
import { TikTokController } from './tiktok.controller';
import { TikTokRepository } from './repositories/tiktok.repository';
import { TikTokService } from './tiktok.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialAccount } from '../entity/social-account.entity';
import { AuthState } from '../facebook/entity/auth-state.entity';
import { TikTokAccount } from './entities/tiktok-account.entity';
import { TikTokMetric } from './entities/tiktok-metric.entity';
import { TikTokVideo } from './entities/tiktok-video.entity';
import { TikTokComment } from './entities/tiktok_comments.entity';
import { TikTokRateLimit } from './entities/tiktok_rate_limits.entity';
import { TikTokConfig } from './config/tiktok.config';

@Module({
  controllers: [TikTokController],
  imports: [
    MulterModule.register({
      dest: './uploads',
    }),
    ConfigModule,
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
    ConfigService,
    // Repository first as it's a dependency
    {
      provide: TikTokRepository,
      useClass: TikTokRepository,
    },
    // Config
    {
      provide: TikTokConfig,
      useFactory: (configService: ConfigService) => ({
        clientKey: configService.get<string>('TIKTOK_CLIENT_KEY'),
        clientSecret: configService.get<string>('TIKTOK_CLIENT_SECRET'),
        redirectUri: configService.get<string>('TIKTOK_REDIRECT_URI'),
        baseUrl: configService.get<string>(
          'TIKTOK_API_BASE_URL',
          'https://open.tiktokapis.com/v2',
        ),
      }),
      inject: [ConfigService],
    },
    // Service with its dependencies
    {
      provide: TikTokService,
      useFactory: (
        configService: ConfigService,
        tiktokRepo: TikTokRepository,
        tiktokConfig: TikTokConfig,
      ) => {
        return new TikTokService(configService, tiktokRepo, tiktokConfig);
      },
      inject: [ConfigService, TikTokRepository, TikTokConfig],
    },
    // Jobs with their dependencies
    {
      provide: TikTokMetricsCollectionJob,
      useFactory: (
        tiktokRepo: TikTokRepository,
        tiktokService: TikTokService,
      ) => {
        return new TikTokMetricsCollectionJob(tiktokRepo, tiktokService);
      },
      inject: [TikTokRepository, TikTokService],
    },
    {
      provide: TikTokTokenRefreshJob,
      useFactory: (
        tiktokRepo: TikTokRepository,
        tiktokService: TikTokService,
      ) => {
        return new TikTokTokenRefreshJob(tiktokRepo, tiktokService);
      },
      inject: [TikTokRepository, TikTokService],
    },
  ],
  exports: [TikTokService],
})
export class TikTokModule {}
