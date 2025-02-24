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
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { FacebookRepository } from '../facebook/repositories/facebook.repository';
import { InstagramRepository } from '../instagram/repositories/instagram.repository';
import { LinkedInRepository } from '../linkedin/repositories/linkedin.repository';
import { SocialPlatform } from 'src/enum/social-platform.enum';
import { TikTokTokenRefreshJob } from './jobs/token-refresh.job';
import { OAuth2Service } from 'src/platform-auth/platform-auth.service';
import { TokenCacheService } from 'src/cache/token-cache.service';

@Module({
  controllers: [TikTokController],
  imports: [
    // Enable scheduling for cron jobs
    ScheduleModule.forRoot(),

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

    // Repositories
    {
      provide: TikTokRepository,
      useClass: TikTokRepository,
    },
    FacebookRepository,
    InstagramRepository,
    LinkedInRepository,

    // Token Cache Service
    TokenCacheService,

    // OAuth2 Service with Platform Configs
    {
      provide: 'PLATFORM_CONFIGS',
      useFactory: (configService: ConfigService) => ({
        [SocialPlatform.TIKTOK]: {
          clientId: configService.get<string>('TIKTOK_CLIENT_KEY'),
          clientSecret: configService.get<string>('TIKTOK_CLIENT_SECRET'),
          redirectUri: configService.get<string>('TIKTOK_REDIRECT_URI'),
          tokenHost: 'https://open.tiktokapis.com',
          tokenPath: '/v2/oauth/token',
          authorizePath: '/v2/oauth/authorize',
          revokePath: '/v2/oauth/revoke',
          scopes: ['user.info.basic'],
          cacheOptions: {
            tokenTTL: 3600,
            refreshTokenTTL: 86400,
          },
        },
        [SocialPlatform.FACEBOOK]: {
          clientId: configService.get<string>('FACEBOOK_CLIENT_ID'),
          clientSecret: configService.get<string>('FACEBOOK_CLIENT_SECRET'),
          redirectUri: configService.get<string>('FACEBOOK_REDIRECT_URI'),
          tokenHost: 'https://graph.facebook.com',
          tokenPath: '/oauth/access_token',
          authorizePath: '/v17.0/dialog/oauth',
          revokePath: '/v17.0/me/permissions',
          scopes: ['public_profile', 'pages_show_list'],
          cacheOptions: {
            tokenTTL: 3600,
            refreshTokenTTL: 86400,
          },
        },
        // Add similar configurations for other platforms
      }),
      inject: [ConfigService],
    },

    // Platform Repositories for OAuth2 Service
    {
      provide: 'PLATFORM_REPOSITORIES',
      useFactory: (
        tiktokRepo: TikTokRepository,
        facebookRepo: FacebookRepository,
        instagramRepo: InstagramRepository,
        linkedinRepo: LinkedInRepository,
      ) => ({
        [SocialPlatform.TIKTOK]: tiktokRepo,
        [SocialPlatform.FACEBOOK]: facebookRepo,
        [SocialPlatform.INSTAGRAM]: instagramRepo,
        [SocialPlatform.LINKEDIN]: linkedinRepo,
      }),
      inject: [
        TikTokRepository,
        FacebookRepository,
        InstagramRepository,
        LinkedInRepository,
      ],
    },

    // OAuth2 Service
    OAuth2Service,

    // TikTok Config
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

    // TikTok Service
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

    // Jobs
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

    // Token Refresh Jobs
    TikTokTokenRefreshJob,
  ],
  exports: [TikTokService],
})
export class TikTokModule {}
