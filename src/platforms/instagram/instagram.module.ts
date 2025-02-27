import { Module } from '@nestjs/common';
import { InstagramMetricsCollectionJob } from './jobs/metrics-collection.job';
import { InstagramTokenRefreshJob } from './jobs/token-refresh.job';
import { InstagramController } from './instagram.controller';
import { InstagramRepository } from './repositories/instagram.repository';
import { InstagramService } from './instagram.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstagramAccount } from './entities/instagram-account.entity';
import { InstagramMetric } from './entities/instagram-metric.entity';
import { SocialAccount } from '../entity/social-account.entity';
import { AuthState } from '../facebook/entity/auth-state.entity';
import { InstagramConfig } from './helpers/instagram.config';
import { InstagramRateLimit } from './entities/instagram-rate-limit.entity';
import { RateLimitInterceptor } from './interceptors/rate-limit.interceptor';
import { InstagramPost } from './entities/instagram-post.entity';
import { MediaStorageModule } from 'src/media-storage/media-storage.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [
    ConfigModule,
    MediaStorageModule,
    DatabaseModule,
    TypeOrmModule.forFeature([
      InstagramAccount,
      InstagramRateLimit,
      InstagramMetric,
      InstagramPost,
      AuthState,
      SocialAccount,
    ]),
  ],
  controllers: [InstagramController],
  providers: [
    {
      provide: InstagramRepository,
      useClass: InstagramRepository,
    },
    InstagramService,
    InstagramMetricsCollectionJob,
    InstagramTokenRefreshJob,
    RateLimitInterceptor,
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
  ],
  exports: [InstagramService, InstagramRepository, RateLimitInterceptor],
})
export class InstagramModule {}
