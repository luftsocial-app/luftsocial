import { SocialPlatform } from '../common/enums/social-platform.enum';
import { FacebookRepository } from '../platforms/facebook/repositories/facebook.repository';
import { InstagramRepository } from '../platforms/instagram/repositories/instagram.repository';
import { LinkedInRepository } from '../platforms/linkedin/repositories/linkedin.repository';
import { TikTokRepository } from '../platforms/tiktok/repositories/tiktok.repository';

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
    [SocialPlatform.INSTAGRAM_BUSINESS]: instagramRepo,
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
