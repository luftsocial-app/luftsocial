import { Injectable } from '@nestjs/common';
import { FacebookService } from './facebook/facebook.service';
import { SocialPlatform } from '../common/enums/social-platform.enum';

@Injectable()
export class PlatformsService {
  constructor(private readonly facebookService: FacebookService) {}

  getServiceForPlatform(platform: SocialPlatform) {
    switch (platform) {
      case SocialPlatform.FACEBOOK:
        return this.facebookService;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  async getConnectedAccountsForUser(
    userId: string,
  ): Promise<Record<SocialPlatform, any[]>> {
    const [facebookAccounts] = await Promise.all([
      this.facebookService.getAccountsByUserId(userId),
    ]);

    return {
      [SocialPlatform.FACEBOOK]: Array.isArray(facebookAccounts)
        ? facebookAccounts
        : [],
    };
  }
}
