import { Injectable } from '@nestjs/common';
import { FacebookService } from './facebook/facebook.service';
import { SocialPlatform } from '../common/enums/social-platform.enum';
import { InstagramService } from './instagram/instagram.service';
import { LinkedInService } from './linkedin/linkedin.service';
import { TikTokService } from './tiktok/tiktok.service';

@Injectable()
export class PlatformsService {
  constructor(
    private readonly facebookService: FacebookService,
    private readonly instagramService: InstagramService,
    private readonly linkedinService: LinkedInService,
    private readonly tiktokService: TikTokService,
  ) {}

  getServiceForPlatform(platform: SocialPlatform) {
    switch (platform) {
      case SocialPlatform.FACEBOOK:
        return this.facebookService;
      case SocialPlatform.INSTAGRAM:
        return this.instagramService;
      case SocialPlatform.LINKEDIN:
        return this.linkedinService;
      case SocialPlatform.TIKTOK:
        return this.tiktokService;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  async getConnectedAccountsForUser(
    userId: string,
  ): Promise<Record<SocialPlatform, any[]>> {
    const [
      facebookAccounts,
      instagramAccounts,
      linkedInAccounts,
      tiktokAccounts,
    ] = await Promise.all([
      this.facebookService.getAccountsByUserId(userId),
      this.instagramService.getAccountsByUserId(userId),
      this.linkedinService.getAccountsByUserId(userId),
      this.tiktokService.getAccountsByUserId(userId),
    ]);

    return {
      [SocialPlatform.FACEBOOK]: Array.isArray(facebookAccounts)
        ? facebookAccounts
        : [],
      [SocialPlatform.INSTAGRAM]: Array.isArray(instagramAccounts)
        ? instagramAccounts
        : [],
      [SocialPlatform.INSTAGRAM_BUSINESS]: Array.isArray(instagramAccounts)
        ? instagramAccounts
        : [],
      [SocialPlatform.LINKEDIN]: Array.isArray(linkedInAccounts)
        ? linkedInAccounts
        : [],
      [SocialPlatform.TIKTOK]: Array.isArray(tiktokAccounts)
        ? tiktokAccounts
        : [],
    };
  }
}
