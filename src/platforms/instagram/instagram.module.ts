import { Module } from '@nestjs/common';
import { InstagramMetricsCollectionJob } from './jobs/metrics-collection.job';
import { InstagramTokenRefreshJob } from './jobs/token-refresh.job';
import { InstagramController } from './instagram.controller';
import { InstagramRepository } from './repositories/Instagram.repository';
import { InstagramService } from './instagram.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstagramAccount } from './entities/instagram-account.entity';
import { InstagramMetric } from './entities/instagram-metric.entity';
import { SocialAccount } from '../entity/social-account.entity';
import { AuthState } from '../facebook/entity/auth-state.entity';
import { InstagramConfig } from './helpers/instagram.config';
import { InstagramRateLimit } from './entities/instagram-rate-limit.entity';
import { InstagramMedia } from './entities/instagram-media.entity';
import { RateLimitInterceptor } from './interceptors/rate-limit.interceptor';

@Module({
  controllers: [InstagramController],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      InstagramAccount,
      InstagramRateLimit,
      InstagramMetric,
      InstagramMedia,
      AuthState,
      SocialAccount,
    ]),
  ],
  providers: [
    // Repository first as it's a dependency for other services
    {
      provide: InstagramRepository,
      useClass: InstagramRepository,
    },
    // Config service and Instagram config
    ConfigService,
    {
      provide: InstagramConfig,
      useFactory: (configService: ConfigService) => ({
        clientId: configService.get<string>('INSTAGRAM_CLIENT_ID'),
        clientSecret: configService.get<string>('INSTAGRAM_CLIENT_SECRET'),
        redirectUri: configService.get<string>('INSTAGRAM_REDIRECT_URI'),
        apiVersion: configService.get<string>('INSTAGRAM_API_VERSION', 'v12.0'),
        baseUrl: configService.get<string>(
          'INSTAGRAM_API_BASE_URL',
          'https://graph.instagram.com',
        ),
      }),
      inject: [ConfigService],
    },
    // Main service
    {
      provide: InstagramService,
      useFactory: (
        configService: ConfigService,
        instagramRepo: InstagramRepository,
        instagramConfig: InstagramConfig,
      ) => {
        return new InstagramService(
          configService,
          instagramRepo,
          instagramConfig,
        );
      },
      inject: [ConfigService, InstagramRepository, InstagramConfig],
    },
    // Jobs
    {
      provide: InstagramMetricsCollectionJob,
      useFactory: (
        instagramRepo: InstagramRepository,
        instagramService: InstagramService,
      ) => {
        return new InstagramMetricsCollectionJob(
          instagramRepo,
          instagramService,
        );
      },
      inject: [InstagramRepository, InstagramService],
    },
    {
      provide: InstagramTokenRefreshJob,
      useFactory: (
        instagramRepo: InstagramRepository,
        instagramService: InstagramService,
      ) => {
        return new InstagramTokenRefreshJob(instagramRepo, instagramService);
      },
      inject: [InstagramRepository, InstagramService],
    },
    // Rate limit interceptor
    {
      provide: RateLimitInterceptor,
      useFactory: (instagramRepo: InstagramRepository) => {
        return new RateLimitInterceptor(instagramRepo);
      },
      inject: [InstagramRepository],
    },
  ],
  exports: [InstagramService, InstagramRepository, RateLimitInterceptor],
})
export class InstagramModule {}
