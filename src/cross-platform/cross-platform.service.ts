import { BadRequestException, Injectable } from '@nestjs/common';
import { SocialPlatform } from 'src/enum/social-platform.enum';
import { FacebookService } from 'src/platforms/facebook/facebook.service';
import { InstagramService } from 'src/platforms/instagram/instagram.service';
import { LinkedInService } from 'src/platforms/linkedin/linkedin.service';
import { TokenResponse } from 'src/platforms/platform-service.interface';
import { TikTokService } from 'src/platforms/tiktok/tiktok.service';
import { ConnectedPlatform } from './helpers/cross-platform.interface';

@Injectable()
export class CrossPlatformService {
  constructor(
    private readonly facebookService: FacebookService,
    private readonly instagramService: InstagramService,
    private readonly linkedinService: LinkedInService,
    private readonly tiktokService: TikTokService,
  ) {}

  async connectPlatform(
    userId: string,
    platform: SocialPlatform,
  ): Promise<string> {
    switch (platform) {
      case SocialPlatform.FACEBOOK:
        return this.facebookService.authorize(userId);
      case SocialPlatform.INSTAGRAM:
        return this.instagramService.authorize(userId);
      case SocialPlatform.LINKEDIN:
        return this.linkedinService.authorize(userId);
      case SocialPlatform.TIKTOK:
        return this.tiktokService.authorize(userId);
      default:
        throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
  }

  async handleCallback(
    platform: SocialPlatform,
    code: string,
    state: string,
    userId: string,
  ): Promise<TokenResponse> {
    switch (platform) {
      case SocialPlatform.FACEBOOK:
        return this.facebookService.handleCallback(code, state, userId);
      case SocialPlatform.INSTAGRAM:
        return this.instagramService.handleCallback(code, state, userId);
      case SocialPlatform.LINKEDIN:
        return this.linkedinService.handleCallback(code, state, userId);
      case SocialPlatform.TIKTOK:
        return this.tiktokService.handleCallback(code, state, userId);
      default:
        throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
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
      // Log error but continue with other platforms
      console.error('Error fetching Facebook accounts:', error);
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
          })),
        });
      }
    } catch (error) {
      // Log error but continue with other platforms
      console.error('Error fetching instagram accounts:', error);
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
          })),
        });
      }
    } catch (error) {
      // Log error but continue with other platforms
      console.error('Error fetching linkedin accounts:', error);
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
      // Log error but continue with other platforms
      console.error('Error fetching Facebook accounts:', error);
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

  async refreshTokens(
    userId: string,
    platform: SocialPlatform,
    accountId: string,
  ): Promise<void> {
    switch (platform) {
      case SocialPlatform.FACEBOOK:
        await this.facebookService.refreshToken(accountId);
        break;
      case SocialPlatform.INSTAGRAM:
        await this.instagramService.refreshToken(accountId);
        break;
      case SocialPlatform.LINKEDIN:
        await this.linkedinService.refreshToken(accountId);
        break;
      case SocialPlatform.TIKTOK:
        await this.tiktokService.refreshToken(accountId);
        break;
      default:
        throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
  }
}
