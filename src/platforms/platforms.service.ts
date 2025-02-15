import { Injectable } from '@nestjs/common';
import { FacebookService } from './facebook/facebook.service';
import { InstagramService } from './instagram/instagram.service';
import { LinkedInService } from './linkedin/linkedin.service';
import { TikTokService } from './tiktok/tiktok.service';
import { SocialPlatform } from 'src/enum/social-platform.enum';

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
}
