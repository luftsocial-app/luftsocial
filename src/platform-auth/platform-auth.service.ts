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

@Injectable()
export class OAuth2Service {
  private oauthClients: Record<SocialPlatform, AuthorizationCode>;

  constructor(
    private readonly tokenCacheService: TokenCacheService,
    @Inject('PLATFORM_CONFIGS')
    readonly platformConfigs: Record<SocialPlatform, PlatformOAuthConfig>,
    @Inject('PLATFORM_REPOSITORIES')
    private readonly platformRepos: Record<SocialPlatform, any>,
  ) {
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

      // Store state in cache
      await this.tokenCacheService.storeState(state, { platform, userId });

      const options = {
        redirect_uri: config.redirectUri,
        scope: config.scopes,
        state,
      };

      if (platform === SocialPlatform.TIKTOK) {
        options['client_key'] = config.clientId;
      }

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

    const cacheKey = this.tokenCacheService.generateKey(
      'access',
      platform,
      code,
    );
    const cachedTokens = await this.tokenCacheService.getToken(cacheKey);
    if (cachedTokens) {
      return cachedTokens;
    }

    try {
      const config = this.platformConfigs[platform];
      const tokenParams = {
        code,
        redirect_uri: config.redirectUri,
        scope: config.scopes,
      };

      if (platform === SocialPlatform.TIKTOK) {
        tokenParams['client_key'] = config.clientId;
        tokenParams['grant_type'] = 'authorization_code';
      }

      const accessToken =
        await this.oauthClients[platform].getToken(tokenParams);
      const tokens = this.formatTokenResponse(platform, accessToken.token);

      // Cache tokens
      await this.tokenCacheService.setToken(
        cacheKey,
        tokens,
        config.cacheOptions.tokenTTL,
      );

      return tokens;
    } catch (error) {
      throw new PlatformError(
        platform,
        'Failed to exchange authorization code',
        error,
      );
    }
  }

  async refreshToken(
    platform: SocialPlatform,
    accountId: string,
  ): Promise<TokenResponse> {
    // Get account from appropriate repository
    const repository = this.platformRepos[platform];
    const account = await repository.getById(accountId);

    if (!account) {
      throw new NotFoundException(
        `${platform} account not found: ${accountId}`,
      );
    }

    try {
      // Get refresh token from account
      const { refreshToken } = account.socialAccount;
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
        await repository.updateAccountTokens(accountId, {
          accessToken: cachedTokens.accessToken,
          refreshToken: cachedTokens.refreshToken,
          expiresAt: new Date(Date.now() + cachedTokens.expiresIn * 1000),
        });

        return cachedTokens;
      }

      // Refresh tokens based on platform
      const tokens = await this.refreshTokenForPlatform(
        platform,
        refreshToken,
        cacheKey,
      );

      // Update account in database
      await repository.updateAccountTokens(accountId, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
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

  private async refreshFacebookToken(token: string): Promise<any> {
    const config = this.platformConfigs[SocialPlatform.FACEBOOK];
    const response = await axios.get(
      'https://graph.facebook.com/oauth/access_token',
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          fb_exchange_token: token,
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
      refreshToken: token.refresh_token,
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
      console.log(error);
      console.warn(`No scopes found for platform: ${platform}`);
      return [];
    }
  }
}
