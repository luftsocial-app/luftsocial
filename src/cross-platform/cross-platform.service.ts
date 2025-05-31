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

    // Facebook
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

    // Instagram (handles both INSTAGRAM and INSTAGRAM_BUSINESS)
    try {
      const instagramAccounts =
        await this.instagramService.getUserAccounts(userId);
      if (
        instagramAccounts &&
        Array.isArray(instagramAccounts) &&
        instagramAccounts.length > 0
      ) {
        // Group accounts by authentication method
        const facebookLoginAccounts = instagramAccounts.filter(
          (account) => !account.platformSpecific?.isBusinessLogin,
        );
        const businessLoginAccounts = instagramAccounts.filter(
          (account) => account.platformSpecific?.isBusinessLogin,
        );

        // Add Instagram with Facebook Login accounts
        if (facebookLoginAccounts.length > 0) {
          connectedPlatforms.push({
            platform: SocialPlatform.INSTAGRAM,
            accounts: facebookLoginAccounts.map((account) => ({
              id: account.id,
              name: account.name,
              type: 'business',
              avatarUrl: account.avatarUrl,
              platformSpecific: {
                authMethod: 'facebook_login',
                instagramId: account.platformSpecific?.instagramId,
                facebookPageId: account.platformSpecific?.facebookPageId,
              },
            })),
          });
        }

        // Add Instagram Business Login accounts
        if (businessLoginAccounts.length > 0) {
          connectedPlatforms.push({
            platform: SocialPlatform.INSTAGRAM_BUSINESS,
            accounts: businessLoginAccounts.map((account) => ({
              id: account.id,
              name: account.name,
              type: account.type || 'business',
              avatarUrl: account.avatarUrl,
              platformSpecific: {
                authMethod: 'instagram_business_login',
                instagramId: account.platformSpecific?.instagramId,
              },
            })),
          });
        }
      } else if (instagramAccounts && !Array.isArray(instagramAccounts)) {
        // Handle case where getUserAccounts returns a single account object
        const account = instagramAccounts;
        const isBusinessLogin = account.platformSpecific?.isBusinessLogin;

        connectedPlatforms.push({
          platform: isBusinessLogin
            ? SocialPlatform.INSTAGRAM_BUSINESS
            : SocialPlatform.INSTAGRAM,
          accounts: [
            {
              id: account.id,
              name: account.name,
              type: account.type || 'business',
              platformSpecific: {
                authMethod: isBusinessLogin
                  ? 'instagram_business_login'
                  : 'facebook_login',
                instagramId: account.platformSpecific?.instagramId,
                facebookPageId: account.platformSpecific?.facebookPageId,
              },
            },
          ],
        });
      }
    } catch (error) {
      this.logger.error('Error fetching Instagram accounts:', error);
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
      this.logger.error('Error fetching LinkedIn accounts:', error);
    }

    // TikTok
    try {
      const tiktokAccount = await this.tiktokService.getUserAccounts(userId);
      if (tiktokAccount) {
        connectedPlatforms.push({
          platform: SocialPlatform.TIKTOK,
          accounts: [
            {
              id: tiktokAccount.id,
              name: tiktokAccount.displayName,
            },
          ],
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
    try {
      switch (platform) {
        case SocialPlatform.FACEBOOK:
          await this.facebookService.revokeAccess(accountId);
          break;
        case SocialPlatform.INSTAGRAM:
          // Handle Instagram with Facebook Login
          await this.instagramService.revokeAccess(accountId);
          break;
        case SocialPlatform.INSTAGRAM_BUSINESS:
          // Handle Instagram Business Login
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

      this.logger.info(
        `Successfully disconnected ${platform} account ${accountId} for user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to disconnect ${platform} account ${accountId} for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get a specific connected account across all platforms
   */
  async getConnectedAccount(
    userId: string,
    platform: SocialPlatform,
    accountId: string,
  ): Promise<any> {
    try {
      switch (platform) {
        case SocialPlatform.FACEBOOK:
          return await this.facebookService.getAccountsByUserId(userId);
        case SocialPlatform.INSTAGRAM:
        case SocialPlatform.INSTAGRAM_BUSINESS:
          return await this.instagramService.getAccountsByUserId(userId);
        case SocialPlatform.LINKEDIN:
          return await this.linkedinService.getAccountsByUserId(userId);
        case SocialPlatform.TIKTOK:
          return await this.tiktokService.getAccountsByUserId(userId);
        default:
          throw new BadRequestException(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to get ${platform} account ${accountId} for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get platform-specific service instance
   */
  private getPlatformService(platform: SocialPlatform) {
    switch (platform) {
      case SocialPlatform.FACEBOOK:
        return this.facebookService;
      case SocialPlatform.INSTAGRAM:
      case SocialPlatform.INSTAGRAM_BUSINESS:
        return this.instagramService;
      case SocialPlatform.LINKEDIN:
        return this.linkedinService;
      case SocialPlatform.TIKTOK:
        return this.tiktokService;
      default:
        throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Check if a user has any connected accounts for a specific platform
   */
  async hasConnectedAccounts(
    userId: string,
    platform: SocialPlatform,
  ): Promise<boolean> {
    try {
      const service = this.getPlatformService(platform);
      const accounts = await service.getUserAccounts(userId);

      if (!accounts) {
        return false;
      }

      // Handle both array and single object returns
      if (Array.isArray(accounts)) {
        return accounts.length > 0;
      } else {
        // Single account object means there's at least one account
        return true;
      }
    } catch (error) {
      this.logger.error(
        `Error checking connected accounts for ${platform}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get total count of connected platforms for a user
   */
  async getConnectedPlatformsCount(userId: string): Promise<number> {
    const connectedPlatforms = await this.getConnectedPlatforms(userId);
    return connectedPlatforms.length;
  }

  /**
   * Get all connected account IDs across all platforms for a user
   */
  async getAllConnectedAccountIds(
    userId: string,
  ): Promise<Record<SocialPlatform, string[]>> {
    const connectedPlatforms = await this.getConnectedPlatforms(userId);
    const accountIds: Record<SocialPlatform, string[]> = {} as Record<
      SocialPlatform,
      string[]
    >;

    // Initialize all platforms with empty arrays
    Object.values(SocialPlatform).forEach((platform) => {
      accountIds[platform] = [];
    });

    connectedPlatforms.forEach((platformData) => {
      accountIds[platformData.platform] = platformData.accounts.map(
        (account) => account.id,
      );
    });

    return accountIds;
  }
}
