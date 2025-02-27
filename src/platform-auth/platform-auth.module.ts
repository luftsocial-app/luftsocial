import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OAuth2Service } from './platform-auth.service';
import { PlatformAuthController } from './platform-auth.controller';
import { TokenCacheModule } from 'src/cache/cache.module';
import { PlatformConfigsProvider } from './config/platform.config';

import { SocialPlatform } from 'src/enum/social-platform.enum';
import { FacebookRepository } from 'src/platforms/facebook/repositories/facebook.repository';
import { InstagramRepository } from 'src/platforms/instagram/repositories/instagram.repository';
import { LinkedInRepository } from 'src/platforms/linkedin/repositories/linkedin.repository';
import { TikTokRepository } from 'src/platforms/tiktok/repositories/tiktok.repository';
import { FacebookAccount } from 'src/platforms/facebook/entity/facebook-account.entity';
import { SocialAccount } from 'src/platforms/entity/social-account.entity';
import { AuthState } from 'src/platforms/facebook/entity/auth-state.entity';
import { FacebookPageMetric } from 'src/platforms/facebook/entity/facebook-page-metric.entity';
import { FacebookPage } from 'src/platforms/facebook/entity/facebook-page.entity';
import { FacebookPostMetric } from 'src/platforms/facebook/entity/facebook-post-metric.entity';
import { FacebookPost } from 'src/platforms/facebook/entity/facebook-post.entity';
import { InstagramAccount } from 'src/platforms/instagram/entities/instagram-account.entity';
import { InstagramMetric } from 'src/platforms/instagram/entities/instagram-metric.entity';
import { InstagramPost } from 'src/platforms/instagram/entities/instagram-post.entity';
import { InstagramRateLimit } from 'src/platforms/instagram/entities/instagram-rate-limit.entity';
import { LinkedInAccount } from 'src/platforms/linkedin/entities/linkedin-account.entity';
import { LinkedInOrganization } from 'src/platforms/linkedin/entities/linkedin-organization.entity';
import {
  LinkedInPost,
  LinkedInMetric,
} from 'src/platforms/linkedin/entities/linkedin-post.entity';
import { TikTokAccount } from 'src/platforms/tiktok/entities/tiktok-account.entity';
import { TikTokMetric } from 'src/platforms/tiktok/entities/tiktok-metric.entity';
import { TikTokVideo } from 'src/platforms/tiktok/entities/tiktok-video.entity';
import { TikTokComment } from 'src/platforms/tiktok/entities/tiktok_comments.entity';
import { TikTokRateLimit } from 'src/platforms/tiktok/entities/tiktok_rate_limits.entity';

@Module({
  providers: [
    OAuth2Service,
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
    OAuth2Service,
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
    TokenCacheModule,
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
  ],
})
export class PlatformAuthModule {}
