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
    ]),
  ],
})
export class PlatformAuthModule {}
