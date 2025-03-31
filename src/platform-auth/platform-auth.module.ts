import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformConfigsProvider } from './config/platform.config';
import { FacebookRepository } from '../platforms/facebook/repositories/facebook.repository';
import { InstagramRepository } from '../platforms/instagram/repositories/instagram.repository';
import { LinkedInRepository } from '../platforms/linkedin/repositories/linkedin.repository';
import { TikTokRepository } from '../platforms/tiktok/repositories/tiktok.repository';
import { LinkedInAccount } from '../entities/socials/linkedin-entities/linkedin-account.entity';
import { LinkedInOrganization } from '../entities/socials/linkedin-entities/linkedin-organization.entity';
import {
  LinkedInPost,
  LinkedInMetric,
} from '../entities/socials/linkedin-entities/linkedin-post.entity';
import { TikTokAccount } from '../entities/socials/tiktok-entities/tiktok-account.entity';
import { TikTokMetric } from '../entities/socials/tiktok-entities/tiktok-metric.entity';
import { TikTokVideo } from '../entities/socials/tiktok-entities/tiktok-video.entity';
import { TikTokComment } from '../entities/socials/tiktok-entities/tiktok_comments.entity';
import { TikTokRateLimit } from '../entities/socials/tiktok-entities/tiktok_rate_limits.entity';
import { CacheModule } from '../cache/cache.module';
import { SocialPlatform } from '../common/enums/social-platform.enum';
import { SocialAccount } from '../entities/notifications/entity/social-account.entity';
import { AuthState } from '../entities/socials/facebook-entities/auth-state.entity';
import { FacebookAccount } from '../entities/socials/facebook-entities/facebook-account.entity';
import { FacebookPageMetric } from '../entities/socials/facebook-entities/facebook-page-metric.entity';
import { FacebookPage } from '../entities/socials/facebook-entities/facebook-page.entity';
import { FacebookPostMetric } from '../entities/socials/facebook-entities/facebook-post-metric.entity';
import { FacebookPost } from '../entities/socials/facebook-entities/facebook-post.entity';
import { InstagramAccount } from '../entities/socials/instagram-entities/instagram-account.entity';
import { InstagramMetric } from '../entities/socials/instagram-entities/instagram-metric.entity';
import { InstagramPost } from '../entities/socials/instagram-entities/instagram-post.entity';
import { InstagramRateLimit } from '../entities/socials/instagram-entities/instagram-rate-limit.entity';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  providers: [
    PlatformAuthService,
    PlatformConfigsProvider,

    // Facebook Repositories
    FacebookRepository,

    // Other Platform Repositories
    InstagramRepository,
    LinkedInRepository,
    TikTokRepository,

    // Platform Repositories Provider
    {
      provide: 'PLATFORM_REPOSITORIES',
      useFactory: (
        facebookRepo: FacebookRepository,
        instagramRepo: InstagramRepository,
        linkedInRepo: LinkedInRepository,
        tiktokRepo: TikTokRepository,
      ) => ({
        [SocialPlatform.FACEBOOK]: facebookRepo,
        [SocialPlatform.INSTAGRAM]: instagramRepo,
        [SocialPlatform.LINKEDIN]: linkedInRepo,
        [SocialPlatform.TIKTOK]: tiktokRepo,
      }),
      inject: [
        FacebookRepository,
        InstagramRepository,
        LinkedInRepository,
        TikTokRepository,
      ],
    },
  ],
  exports: [
    PlatformAuthService,
    PlatformConfigsProvider,
    'PLATFORM_REPOSITORIES',

    // Export all repositories
    FacebookRepository,
    InstagramRepository,
    LinkedInRepository,
    TikTokRepository,
  ],
  controllers: [PlatformAuthController],
  imports: [
    CacheModule,
    TypeOrmModule.forFeature([
      // Include any necessary entities
      FacebookAccount,
      FacebookPage,
      FacebookPost,
      FacebookPostMetric,
      FacebookPageMetric,
      InstagramAccount,
      InstagramRateLimit,
      InstagramMetric,
      InstagramPost,
      LinkedInAccount,
      LinkedInOrganization,
      LinkedInPost,
      LinkedInMetric,
      TikTokAccount,
      TikTokVideo,
      TikTokMetric,
      TikTokRateLimit,
      TikTokComment,
      AuthState,
      SocialAccount,
    ]),
    DatabaseModule,
  ],
})
export class PlatformAuthModule {}
