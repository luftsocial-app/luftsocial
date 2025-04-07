import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformConfigsProvider } from './config/platform.config';
import { FacebookRepository } from '../platforms/facebook/repositories/facebook.repository';
import { InstagramRepository } from '../platforms/instagram/repositories/instagram.repository';
import { LinkedInRepository } from '../platforms/linkedin/repositories/linkedin.repository';
import { TikTokRepository } from '../platforms/tiktok/repositories/tiktok.repository';
import { LinkedInAccount } from '../platforms/entities/linkedin-entities/linkedin-account.entity';
import { LinkedInOrganization } from '../platforms/entities/linkedin-entities/linkedin-organization.entity';
import {
  LinkedInPost,
  LinkedInMetric,
} from '../platforms/entities/linkedin-entities/linkedin-post.entity';
import { TikTokAccount } from '../platforms/entities/tiktok-entities/tiktok-account.entity';
import { TikTokMetric } from '../platforms/entities/tiktok-entities/tiktok-metric.entity';
import { TikTokVideo } from '../platforms/entities/tiktok-entities/tiktok-video.entity';
import { TikTokComment } from '../platforms/entities/tiktok-entities/tiktok_comments.entity';
import { TikTokRateLimit } from '../platforms/entities/tiktok-entities/tiktok_rate_limits.entity';
import { CacheModule } from '../cache/cache.module';
import { SocialPlatform } from '../common/enums/social-platform.enum';
import { AuthState } from '../platforms/entities/facebook-entities/auth-state.entity';
import { FacebookAccount } from '../platforms/entities/facebook-entities/facebook-account.entity';
import { FacebookPageMetric } from '../platforms/entities/facebook-entities/facebook-page-metric.entity';
import { FacebookPage } from '../platforms/entities/facebook-entities/facebook-page.entity';
import { FacebookPostMetric } from '../platforms/entities/facebook-entities/facebook-post-metric.entity';
import { FacebookPost } from '../platforms/entities/facebook-entities/facebook-post.entity';
import { InstagramAccount } from '../platforms/entities/instagram-entities/instagram-account.entity';
import { InstagramMetric } from '../platforms/entities/instagram-entities/instagram-metric.entity';
import { InstagramPost } from '../platforms/entities/instagram-entities/instagram-post.entity';
import { InstagramRateLimit } from '../platforms/entities/instagram-entities/instagram-rate-limit.entity';
import { SocialAccount } from '../platforms/entities/notifications/entity/social-account.entity';
import { TenantModule } from 'src/user-management/tenant/tenant.module';

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
    TenantModule,
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
