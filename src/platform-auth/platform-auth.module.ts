import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OAuth2Service } from './platform-auth.service';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformConfigsProvider } from './config/platform.config';
import { FacebookRepository } from '../platforms/facebook/repositories/facebook.repository';
import { InstagramRepository } from '../platforms/instagram/repositories/instagram.repository';
import { LinkedInRepository } from '../platforms/linkedin/repositories/linkedin.repository';
import { TikTokRepository } from '../platforms/tiktok/repositories/tiktok.repository';
import { FacebookAccount } from '../platforms/facebook/entity/facebook-account.entity';
import { SocialAccount } from '../platforms/entity/social-account.entity';
import { AuthState } from '../platforms/facebook/entity/auth-state.entity';
import { FacebookPageMetric } from '../platforms/facebook/entity/facebook-page-metric.entity';
import { FacebookPage } from '../platforms/facebook/entity/facebook-page.entity';
import { FacebookPostMetric } from '../platforms/facebook/entity/facebook-post-metric.entity';
import { FacebookPost } from '../platforms/facebook/entity/facebook-post.entity';
import { InstagramAccount } from '../platforms/instagram/entities/instagram-account.entity';
import { InstagramMetric } from '../platforms/instagram/entities/instagram-metric.entity';
import { InstagramPost } from '../platforms/instagram/entities/instagram-post.entity';
import { InstagramRateLimit } from '../platforms/instagram/entities/instagram-rate-limit.entity';
import { LinkedInAccount } from '../platforms/linkedin/entities/linkedin-account.entity';
import { LinkedInOrganization } from '../platforms/linkedin/entities/linkedin-organization.entity';
import {
  LinkedInPost,
  LinkedInMetric,
} from '../platforms/linkedin/entities/linkedin-post.entity';
import { TikTokAccount } from '../platforms/tiktok/entities/tiktok-account.entity';
import { TikTokMetric } from '../platforms/tiktok/entities/tiktok-metric.entity';
import { TikTokVideo } from '../platforms/tiktok/entities/tiktok-video.entity';
import { TikTokComment } from '../platforms/tiktok/entities/tiktok_comments.entity';
import { TikTokRateLimit } from '../platforms/tiktok/entities/tiktok_rate_limits.entity';
import { CacheModule } from '../cache/cache.module';
import { SocialPlatform } from '../common/enums/social-platform.enum';

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
  ],
})
export class PlatformAuthModule {}
