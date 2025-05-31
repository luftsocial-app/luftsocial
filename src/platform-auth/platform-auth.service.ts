import * as crypto from 'crypto';
import axios from 'axios';
import { AuthorizationCode } from 'simple-oauth2';
import {
  Injectable,
  Inject,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import {
  PlatformOAuthConfig,
  TokenResponse,
} from '../platforms/platform-service.interface';
import { PlatformError } from '../platforms/platform.error';
import { TokenCacheService } from '../cache/token-cache.service';
import { SocialPlatform } from '../common/enums/social-platform.enum';
import { PinoLogger } from 'nestjs-pino';
import { TenantService } from '../user-management/tenant.service';

@Injectable()
export class PlatformAuthService {
  private oauthClients: Record<SocialPlatform, AuthorizationCode>;

  constructor(
    private readonly tokenCacheService: TokenCacheService,
    @Inject('PLATFORM_CONFIGS')
    readonly platformConfigs: Record<SocialPlatform, PlatformOAuthConfig>,
    @Inject('PLATFORM_REPOSITORIES')
    private readonly platformRepos: Record<SocialPlatform, any>,
    private readonly logger: PinoLogger,
    private readonly tenantService: TenantService,
  ) {
    this.logger.setContext(PlatformAuthService.name);
    this.initializeOAuthClients();
  }

  private initializeOAuthClients() {
    this.oauthClients = Object.entries(this.platformConfigs).reduce(
      (clients, [platform, config]) => {
        clients[platform as SocialPlatform] = new AuthorizationCode({
          client: {
            id: config.clientId,
            secret: config.clientSecret,
          },
          auth: {
            tokenHost: config.tokenHost,
            tokenPath: config.tokenPath,
            authorizePath: config.authorizePath,
            revokePath: config.revokePath,
          },
        });
        return clients;
      },
      {} as Record<SocialPlatform, AuthorizationCode>,
    );
  }

  async getAuthorizationUrl(
    platform: SocialPlatform,
    userId: string,
  ): Promise<string> {
    try {
      const config = this.platformConfigs[platform];
      const state = crypto.randomBytes(32).toString('hex');

      await this.tokenCacheService.storeState(state, { platform, userId });

      if (platform === SocialPlatform.TIKTOK) {
        // TODOS: Move to config file
        const baseUrl = 'https://www.tiktok.com/v2/auth/authorize/';
        const scope = encodeURIComponent(config.scopes.join(',')); // comma-separated + encoded

        const url =
          `${baseUrl}?client_key=${config.clientId}` +
          `&scope=${scope}` +
          `&response_type=code` +
          `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
          `&state=${state}`;

        return url;
      }

      // Default path for other platforms
      const options = {
        redirect_uri: config.redirectUri,
        scope: config.scopes,
        state,
      };

      return this.oauthClients[platform].authorizeURL(options);
    } catch (error) {
      throw new PlatformError(
        platform,
        'Failed to generate authorization URL',
        error,
      );
    }
  }

  async handleCallback(
    platform: SocialPlatform,
    code: string,
    state: string,
  ): Promise<TokenResponse> {
    // Verify state from cache
    const storedState = await this.tokenCacheService.getStoredState(state);
    if (!storedState) {
      throw new UnauthorizedException('Invalid state parameter');
    }

    // Get the userId from the stored state
    const { userId } = storedState;
    if (!userId) {
      throw new UnauthorizedException('User information missing from state');
    }

    const cacheKey = this.tokenCacheService.generateKey(
      'access',
      platform,
      code,
    );
    const cachedTokens = await this.tokenCacheService.getToken(cacheKey);
    const tenantId = this.tenantService.getTenantId();

    if (cachedTokens) {
      // Create account with cached tokens
      await this.createPlatformAccount(
        tenantId,
        platform,
        userId,
        cachedTokens,
      );
      return cachedTokens;
    }

    try {
      const config = this.platformConfigs[platform];
      let accessToken;

      // Handle token exchange based on platform
      if (platform === SocialPlatform.FACEBOOK) {
        accessToken = await this.exchangeFacebookToken(code, config);
      } else if (platform === SocialPlatform.TIKTOK) {
        accessToken = await this.exchangeTikTokToken(code, config);
      } else {
        const tokenParams = {
          code,
          redirect_uri: config.redirectUri,
          scope: config.scopes,
        };

        try {
          // Exchange authorization code for token
          accessToken = await this.oauthClients[platform].getToken(tokenParams);
        } catch (tokenError) {
          throw new PlatformError(
            platform,
            'Failed to exchange authorization code for token',
            tokenError,
          );
        }
      }

      const tokens = this.formatTokenResponse(platform, accessToken.token);

      // Cache tokens
      await this.tokenCacheService.setToken(
        cacheKey,
        tokens,
        config.cacheOptions.tokenTTL,
      );

      // Create a new account with the tokens
      await this.createPlatformAccount(tenantId, platform, userId, tokens);

      return tokens;
    } catch (error) {
      throw new PlatformError(platform, 'Failed in callback handler', error);
    }
  }

  private async createPlatformAccount(
    tenantId: string,
    platform: SocialPlatform,
    userId: string,
    tokens: TokenResponse,
  ): Promise<any> {
    try {
      // Get the appropriate repository for the platform
      const repository = this.platformRepos[platform];
      if (!repository) {
        throw new Error(`Repository not found for platform: ${platform}`);
      }

      // Get additional user information from the platform if needed
      const userInfo = await this.fetchUserInfo(platform, tokens.accessToken);

      // Create account data based on platform
      const accountData = this.createAccountData(
        platform,
        userId,
        tokens,
        userInfo,
        tenantId,
      );

      // Create and save the account
      return await repository.createAccount(accountData);
    } catch (error) {
      throw new PlatformError(
        platform,
        `Failed to create account for user ${userId}`,
        error,
      );
    }
  }

  private async fetchUserInfo(
    platform: SocialPlatform,
    accessToken: string,
  ): Promise<any> {
    try {
      switch (platform) {
        case SocialPlatform.FACEBOOK:
          return await this.fetchFacebookUserInfo(accessToken);
        case SocialPlatform.INSTAGRAM:
          return await this.fetchInstagramUserInfo(accessToken);
        case SocialPlatform.LINKEDIN:
          return await this.fetchLinkedInUserInfo(accessToken);
        case SocialPlatform.TIKTOK:
          return await this.fetchTikTokUserInfo(accessToken);
        default:
          return {};
      }
    } catch (error) {
      throw new PlatformError(platform, 'Failed to fetch user info', error);
    }
  }

  private async fetchFacebookUserInfo(accessToken: string): Promise<any> {
    const response = await axios.get('https://graph.facebook.com/me', {
      params: {
        fields: 'id,name,email',
        access_token: accessToken,
      },
    });
    return response.data;
  }

  private async fetchInstagramUserInfo(accessToken: string): Promise<any> {
    const response = await axios.get('https://graph.instagram.com/me', {
      params: {
        fields: 'id,username',
        access_token: accessToken,
      },
    });
    return response.data;
  }

  private async fetchLinkedInUserInfo(accessToken: string): Promise<any> {
    const response = await axios.get('https://api.linkedin.com/v2/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  }

  private async fetchTikTokUserInfo(accessToken: string): Promise<any> {
    const config = this.platformConfigs[SocialPlatform.TIKTOK];
    const response = await axios.get(`${config.baseUrl}/user/info/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        fields:
          'open_id,union_id,avatar_url,display_name,avatar_url_100,avatar_large_url,bio_description,profile_deep_link,is_verified,username,follower_count,following_count,likes_count,video_count',
      },
    });
    return response.data.data;
  }

  private createAccountData(
    platform: SocialPlatform,
    userId: string,
    tokens: TokenResponse,
    userInfo: any,
    tenantId: string,
  ): any {
    const permissions =
      tokens.scope && tokens.scope.length > 0
        ? tokens.scope
        : ['public_profile'];
    // 60 days in seconds
    const expiresIn = 60 * 24 * 60 * 60;

    // Calculate the expiration date
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const baseAccountData = {
      userId,
      tenantId,
      permissions,
      socialAccount: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresIn
          ? new Date(Date.now() + tokens.expiresIn * 1000)
          : expiresAt,
        scope: tokens.scope,
        platform,
        platformUserId: userInfo.id || userId,
        tokenExpiresAt: tokens.expiresIn
          ? new Date(Date.now() + tokens.expiresIn * 1000)
          : expiresAt,
      },
    };

    switch (platform) {
      case SocialPlatform.FACEBOOK:
        return {
          ...baseAccountData,
          facebookUserId: userInfo.id,
          name: userInfo.name || 'Unknown',
          email: userInfo.email,
        };
      case SocialPlatform.INSTAGRAM:
        return {
          ...baseAccountData,
          instagramId: userInfo.id,
          username: userInfo.username,
        };
      case SocialPlatform.LINKEDIN:
        return {
          ...baseAccountData,
          linkedinId: userInfo.id,
          name: `${userInfo.localizedFirstName} ${userInfo.localizedLastName}`,
        };
      case SocialPlatform.TIKTOK:
        return {
          ...baseAccountData,
          openId: tokens.openId || userInfo.open_id,
          displayName: userInfo.user?.display_name,
          avatarUrl: userInfo.user?.avatar_url,
          tiktokUserName: userInfo.user?.username,
          isVerified: userInfo.user?.is_verified,
          bio_description: userInfo.user?.bio_description,
          avatarLargeUrl: userInfo.user?.avatar_large_url,
          avatarUrl100: userInfo.user?.avatar_url_100,
          profileDeepLink: userInfo.user?.profile_deep_link, //The link to user's TikTok profile page
          followerCount: userInfo.user?.follower_count,
          followingCount: userInfo.user?.following_count,
          likesCount: userInfo.user?.likes_count,
          videoCount: userInfo.user?.video_count,
        };
      default:
        return baseAccountData;
    }
  }

  async refreshToken(
    platform: SocialPlatform,
    accountId: string,
  ): Promise<TokenResponse> {
    // Get account from appropriate repository
    const repository = this.platformRepos[platform];
    const account = await repository.getAccountById(accountId);

    if (!account) {
      throw new NotFoundException(
        `${platform} account not found: ${accountId}`,
      );
    }

    try {
      const { socialAccount } = account;

      if (platform === SocialPlatform.FACEBOOK) {
        // If no refresh token exists (new user) or we're trying to refresh
        // Facebook always uses the same token as both access and refresh token
        const { accessToken, refreshToken } = socialAccount;

        // Use either refresh token or access token, whichever is available
        const tokenToUse = refreshToken || accessToken;

        if (!tokenToUse) {
          throw new UnauthorizedException(
            'Facebook authorization required. No access token available.',
          );
        }

        // For Facebook, we extend the long-lived token or exchange a short-lived token
        const tokens = await this.refreshTokenForPlatform(
          platform,
          tokenToUse,
          null, // We'll generate cache key after we get the token
        );

        // Facebook tokens don't have an expiry date from the API, so use a fixed period
        // Typically long-lived tokens last for 60 days (in seconds)
        const expiresIn = tokens.expiresIn || 60 * 24 * 60 * 60; // 60 days in seconds
        const expiresAt = new Date(Date.now() + expiresIn * 1000);

        // Update account in database
        await repository.updateAccountTokens(account.id, {
          accessToken: tokens.accessToken,
          refreshToken: tokens.accessToken, // For Facebook, same token for both
          expiresAt: expiresAt,
        });

        // Cache the new tokens
        const cacheKey = this.tokenCacheService.generateKey(
          'refresh',
          platform,
          tokens.accessToken,
        );
        const ttl = this.platformConfigs[platform].cacheOptions.refreshTokenTTL;
        await this.tokenCacheService.setToken(cacheKey, tokens, ttl);

        return tokens;
      }

      // For other platforms (non-Facebook)
      const { refreshToken } = socialAccount;

      if (!refreshToken) {
        throw new UnauthorizedException('No refresh token available');
      }

      // Check cache first
      const cacheKey = this.tokenCacheService.generateKey(
        'refresh',
        platform,
        refreshToken,
      );
      const cachedTokens = await this.tokenCacheService.getToken(cacheKey);

      if (cachedTokens) {
        // Update account with cached tokens
        const expiresAt = new Date(Date.now() + cachedTokens.expiresIn * 1000);

        await repository.updateAccountTokens(account.id, {
          accessToken: cachedTokens.accessToken,
          refreshToken: cachedTokens.refreshToken,
          expiresAt: expiresAt,
        });

        return cachedTokens;
      }

      // Refresh tokens based on platform
      const tokens = await this.refreshTokenForPlatform(
        platform,
        refreshToken,
        cacheKey,
      );

      // Calculate expiration date, ensure it's a valid date
      const expiresIn = tokens.expiresIn || 3600; // Default to 1 hour if not provided
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Update account in database
      await repository.updateAccountTokens(account.id, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || refreshToken, // Keep old refresh token if new one not provided
        expiresAt: expiresAt,
      });

      // Cache the new tokens
      const ttl = this.platformConfigs[platform].cacheOptions.refreshTokenTTL;
      await this.tokenCacheService.setToken(cacheKey, tokens, ttl);

      return tokens;
    } catch (error) {
      throw new PlatformError(
        platform,
        `Failed to refresh token for account ${accountId}`,
        error,
      );
    }
  }

  async refreshTokenForPlatform(
    platform: SocialPlatform,
    refreshToken: string,
    cacheKey: string,
  ): Promise<TokenResponse> {
    try {
      let refreshedToken;
      switch (platform) {
        case SocialPlatform.FACEBOOK:
        case SocialPlatform.INSTAGRAM:
          refreshedToken = await this.refreshFacebookToken(refreshToken);
          break;
        case SocialPlatform.LINKEDIN:
          refreshedToken = await this.refreshLinkedInToken(refreshToken);
          break;
        case SocialPlatform.TIKTOK:
          refreshedToken = await this.refreshTikTokToken(refreshToken);
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      const tokens = this.formatTokenResponse(platform, refreshedToken);

      // Cache refreshed tokens
      await this.tokenCacheService.setToken(
        cacheKey,
        tokens,
        this.platformConfigs[platform].cacheOptions.refreshTokenTTL,
      );

      return tokens;
    } catch (error) {
      throw new PlatformError(platform, 'Failed to refresh token', error);
    }
  }

  async revokeToken(platform: SocialPlatform, token: string): Promise<void> {
    try {
      const accessToken = this.oauthClients[platform].createToken({
        access_token: token,
      });

      await accessToken.revoke('access_token');

      // Clear from cache
      const accessKey = this.tokenCacheService.generateKey(
        'access',
        platform,
        token,
      );
      const refreshKey = this.tokenCacheService.generateKey(
        'refresh',
        platform,
        token,
      );

      await Promise.all([
        this.tokenCacheService.deleteToken(accessKey),
        this.tokenCacheService.deleteToken(refreshKey),
      ]);
    } catch (error) {
      throw new PlatformError(platform, 'Failed to revoke token', error);
    }
  }

  private async exchangeFacebookToken(
    code: string,
    config: PlatformOAuthConfig,
  ): Promise<any> {
    try {
      // Using axios directly instead of simple-oauth2 to control the request fully
      const response = await axios.get(
        'https://graph.facebook.com/v18.0/oauth/access_token',
        {
          params: {
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: config.redirectUri,
            code: code,
          },
          headers: {
            Accept: 'application/json',
          },
        },
      );

      // Format the response to match what simple-oauth2 would return
      return {
        token: response.data,
      };
    } catch (error) {
      this.logger.error(
        'Facebook token exchange error:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  private async exchangeTikTokToken(
    code: string,
    config: PlatformOAuthConfig,
  ): Promise<any> {
    try {
      const response = await axios.post(
        'https://open.tiktokapis.com/v2/oauth/token/',
        new URLSearchParams({
          client_key: config.clientId,
          client_secret: config.clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: config.redirectUri,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
        },
      );

      return {
        token: response.data,
      };
    } catch (error) {
      this.logger.error(
        'TikTok token exchange error:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  private async refreshFacebookToken(token: string): Promise<any> {
    const config = this.platformConfigs[SocialPlatform.FACEBOOK];
    const response = await axios.get(
      'https://graph.facebook.com/v18.0/oauth/access_token',
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          fb_exchange_token: token,
        },
        headers: {
          Accept: 'application/json',
        },
      },
    );
    return response.data;
  }

  private async refreshLinkedInToken(refreshToken: string): Promise<any> {
    const accessToken = this.oauthClients[SocialPlatform.LINKEDIN].createToken({
      refresh_token: refreshToken,
    });
    return await accessToken.refresh();
  }

  private async refreshTikTokToken(refreshToken: string): Promise<any> {
    const config = this.platformConfigs[SocialPlatform.TIKTOK];
    const response = await axios.post(config.tokenHost + config.tokenPath, {
      client_key: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    return response.data;
  }

  private formatTokenResponse(
    platform: SocialPlatform,
    token: any,
  ): TokenResponse {
    const base = {
      accessToken: token.access_token,
      refreshToken: token.access_token,
      expiresIn: token.expires_in,
      tokenType: token.token_type,
      scope: token.scope?.split(',') || [],
    };

    // Add platform-specific fields
    switch (platform) {
      case SocialPlatform.FACEBOOK:
      case SocialPlatform.INSTAGRAM:
        return {
          ...base,
          userId: token.user_id,
        };
      case SocialPlatform.TIKTOK:
        return {
          ...base,
          openId: token.open_id,
        };
      default:
        return base;
    }
  }

  getPlatformScopes(platform: SocialPlatform): string[] {
    try {
      return this.platformConfigs[platform].scopes || [];
    } catch (error) {
      // Log the error or handle cases where platform might not exist]
      this.logger.error(error);
      this.logger.warn(
        `Error fetching scopes for platform ${platform}: ${error.message}`,
      );
      return [];
    }
  }
}
