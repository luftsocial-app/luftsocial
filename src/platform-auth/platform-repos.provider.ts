import { SocialPlatform } from 'src/enum/social-platform.enum';
import { FacebookRepository } from 'src/platforms/facebook/repositories/facebook.repository';
import { InstagramRepository } from 'src/platforms/instagram/repositories/instagram.repository';
import { LinkedInRepository } from 'src/platforms/linkedin/repositories/linkedin.repository';
import { TikTokRepository } from 'src/platforms/tiktok/repositories/tiktok.repository';

export const PlatformRepositoriesProvider = {
  provide: 'PLATFORM_REPOSITORIES',
  useFactory: (
    facebookRepo: FacebookRepository,
    instagramRepo: InstagramRepository,
    linkedinRepo: LinkedInRepository,
    tiktokRepo: TikTokRepository,
  ) => ({
    [SocialPlatform.FACEBOOK]: facebookRepo,
    [SocialPlatform.INSTAGRAM]: instagramRepo,
    [SocialPlatform.LINKEDIN]: linkedinRepo,
    [SocialPlatform.TIKTOK]: tiktokRepo,
  }),
  inject: [
    FacebookRepository,
    InstagramRepository,
    LinkedInRepository,
    TikTokRepository,
  ],
};
