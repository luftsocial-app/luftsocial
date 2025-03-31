import { BadRequestException, Injectable } from '@nestjs/common';
import { FacebookService } from '../platforms/facebook/facebook.service';
import { InstagramService } from '../platforms/instagram/instagram.service';
import { LinkedInService } from '../platforms/linkedin/linkedin.service';
import { TikTokService } from '../platforms/tiktok/tiktok.service';
import { ConnectedPlatform } from './helpers/cross-platform.interface';
import { SocialPlatform } from '../common/enums/social-platform.enum';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class CrossPlatformService {
  constructor(
    private readonly facebookService: FacebookService,
    private readonly instagramService: InstagramService,
    private readonly linkedinService: LinkedInService,
    private readonly tiktokService: TikTokService,

    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CrossPlatformService.name);
  }

  async getConnectedPlatforms(userId: string): Promise<ConnectedPlatform[]> {
    const connectedPlatforms: ConnectedPlatform[] = [];

    try {
      const facebookAccounts =
        await this.facebookService.getUserAccounts(userId);
      if (facebookAccounts?.length) {
        connectedPlatforms.push({
          platform: SocialPlatform.FACEBOOK,
          accounts: facebookAccounts.map((account) => ({
            id: account.id,
            name: account.name,
            type: 'page',
          })),
        });
      }
    } catch (error) {
      this.logger.error('Error fetching Facebook accounts:', error);
    }
    // Instagram
    try {
      const instagramAccounts =
        await this.instagramService.getUserAccounts(userId);
      if (instagramAccounts?.length) {
        connectedPlatforms.push({
          platform: SocialPlatform.INSTAGRAM,
          accounts: instagramAccounts.map((account) => ({
            id: account.id,
            name: account.name,
            type: 'individual',
          })),
        });
      }
    } catch (error) {
      this.logger.error('Error fetching instagram accounts:', error);
    }
    // LinkedIn

    try {
      const linkedInAccounts =
        await this.linkedinService.getUserAccounts(userId);
      if (linkedInAccounts?.length) {
        connectedPlatforms.push({
          platform: SocialPlatform.LINKEDIN,
          accounts: linkedInAccounts.map((account) => ({
            id: account.id,
            name: account.name,
            type: account.type,
          })),
        });
      }
    } catch (error) {
      this.logger.error('Error fetching linkedin accounts:', error);
    }

    // TikTok
    try {
      const tiktokAccounts = await this.tiktokService.getUserAccounts(userId);
      if (tiktokAccounts?.length) {
        connectedPlatforms.push({
          platform: SocialPlatform.TIKTOK,
          accounts: tiktokAccounts.map((account) => ({
            id: account.id,
            name: account.name,
            type: 'page',
          })),
        });
      }
    } catch (error) {
      this.logger.error('Error fetching TikTok accounts:', error);
    }

    return connectedPlatforms;
  }

  async disconnectPlatform(
    userId: string,
    platform: SocialPlatform,
    accountId: string,
  ): Promise<void> {
    switch (platform) {
      case SocialPlatform.FACEBOOK:
        await this.facebookService.revokeAccess(accountId);
        break;
      case SocialPlatform.INSTAGRAM:
        await this.instagramService.revokeAccess(accountId);
        break;
      case SocialPlatform.LINKEDIN:
        await this.linkedinService.revokeAccess(accountId);
        break;
      case SocialPlatform.TIKTOK:
        await this.tiktokService.revokeAccess(accountId);
        break;
      default:
        throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
  }
}
