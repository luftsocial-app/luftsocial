import { Injectable } from '@nestjs/common';
import { FacebookService } from './facebook/facebook.service';
import { SocialPlatform } from '../common/enums/social-platform.enum';
import { InstagramService } from './instagram/instagram.service';

@Injectable()
export class PlatformsService {
  constructor(
    private readonly facebookService: FacebookService,
    private readonly instagramService: InstagramService,
  ) {}

  getServiceForPlatform(platform: SocialPlatform) {
    switch (platform) {
      case SocialPlatform.FACEBOOK:
        return this.facebookService;
      case SocialPlatform.INSTAGRAM:
        return this.instagramService;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  async getConnectedAccountsForUser(
    userId: string,
  ): Promise<Record<SocialPlatform, any[]>> {
    const [facebookAccounts, instagramAccounts] = await Promise.all([
      this.facebookService.getAccountsByUserId(userId),
      this.instagramService.getAccountsByUserId(userId),
    ]);

    return {
      [SocialPlatform.FACEBOOK]: Array.isArray(facebookAccounts)
        ? facebookAccounts
        : [],
      [SocialPlatform.INSTAGRAM]: Array.isArray(instagramAccounts)
        ? instagramAccounts
        : [],
    };
  }
}
