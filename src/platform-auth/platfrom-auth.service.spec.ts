import { Test, TestingModule } from '@nestjs/testing';
import * as crypto from 'crypto';
import axios from 'axios';
import { AuthorizationCode } from 'simple-oauth2';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { TokenCacheService } from '../cache/token-cache.service';
import { SocialPlatform } from '../common/enums/social-platform.enum';
import { PlatformError } from '../platforms/platform.error';
import { PlatformAuthService } from './platform-auth.service';
import { PinoLogger } from 'nestjs-pino';
import { TenantService } from '../user-management/tenant/tenant.service';

// Mock simple-oauth2
jest.mock('simple-oauth2');
jest.mock('axios');

describe('PlatformAuthService', () => {
  let service: PlatformAuthService;
  let tokenCacheService: jest.Mocked<TokenCacheService>;
  let tenantService: jest.Mocked<TenantService>;
  let mockPlatformConfigs;
  let mockPlatformRepos;
  let mockAuthorizationCode;
  let mockAxios;
  let logger: PinoLogger;

  const mockUserId = 'user123';
  const mockTenantId = 'tenant123';
  const mockCode = 'auth_code_123';
  const mockState = 'random_state_123';
  const mockToken = 'access_token_123';
  const mockRefreshToken = 'refresh_token_123';
  const mockAccountId = 'account123';

  beforeEach(async () => {
    // Mock crypto.randomBytes
    jest.spyOn(crypto, 'randomBytes').mockImplementation(() => {
      return {
        toString: jest.fn().mockReturnValue(mockState),
      } as unknown as Buffer;
    });

    // Create mocks
    mockAuthorizationCode = {
      authorizeURL: jest.fn().mockReturnValue('https://example.com/auth'),
      getToken: jest.fn().mockResolvedValue({
        token: {
          access_token: mockToken,
          refresh_token: mockRefreshToken,
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'read,write',
        },
      }),
      createToken: jest.fn().mockReturnValue({
        refresh: jest.fn().mockResolvedValue({
          token: {
            access_token: 'new_access_token',
            refresh_token: 'new_refresh_token',
            expires_in: 3600,
            token_type: 'Bearer',
            scope: 'read,write',
          },
        }),
        revoke: jest.fn().mockResolvedValue({}),
      }),
    };

    // Mock AuthorizationCode constructor
    (AuthorizationCode as jest.Mock).mockImplementation(
      () => mockAuthorizationCode,
    );

    // Mock axios
    mockAxios = axios as jest.Mocked<typeof axios>;
    mockAxios.get.mockResolvedValue({
      data: {
        access_token: 'new_facebook_token',
        refresh_token: 'new_facebook_refresh_token',
        expires_in: 3600,
      },
    });
    mockAxios.post.mockResolvedValue({
      data: {
        access_token: 'new_tiktok_token',
        refresh_token: 'new_tiktok_refresh_token',
        expires_in: 3600,
        open_id: 'tiktok_open_id',
      },
    });

    // Platform configs
    mockPlatformConfigs = {
      [SocialPlatform.FACEBOOK]: {
        clientId: 'fb_client_id',
        clientSecret: 'fb_client_secret',
        redirectUri: 'https://example.com/auth/facebook/callback',
        scopes: ['public_profile', 'email'],
        tokenHost: 'https://graph.facebook.com',
        tokenPath: '/oauth/access_token',
        authorizePath: '/oauth/authorize',
        revokePath: '/oauth/revoke',
        cacheOptions: {
          tokenTTL: 3600,
          refreshTokenTTL: 86400,
        },
      },
      [SocialPlatform.INSTAGRAM]: {
        clientId: 'ig_client_id',
        clientSecret: 'ig_client_secret',
        redirectUri: 'https://example.com/auth/instagram/callback',
        scopes: ['user_profile', 'user_media'],
        tokenHost: 'https://api.instagram.com',
        tokenPath: '/oauth/access_token',
        authorizePath: '/oauth/authorize',
        revokePath: '/oauth/revoke',
        cacheOptions: {
          tokenTTL: 3600,
          refreshTokenTTL: 86400,
        },
      },
      [SocialPlatform.LINKEDIN]: {
        clientId: 'li_client_id',
        clientSecret: 'li_client_secret',
        redirectUri: 'https://example.com/auth/linkedin/callback',
        scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social'],
        tokenHost: 'https://www.linkedin.com',
        tokenPath: '/oauth/v2/accessToken',
        authorizePath: '/oauth/v2/authorization',
        revokePath: '/oauth/v2/revoke',
        cacheOptions: {
          tokenTTL: 3600,
          refreshTokenTTL: 86400,
        },
      },
      [SocialPlatform.TIKTOK]: {
        clientId: 'tt_client_id',
        clientSecret: 'tt_client_secret',
        redirectUri: 'https://example.com/auth/tiktok/callback',
        scopes: ['user.info.basic', 'video.list'],
        tokenHost: 'https://open-api.tiktok.com',
        tokenPath: '/oauth/access_token/',
        authorizePath: '/oauth/authorize/',
        revokePath: '/oauth/revoke/',
        cacheOptions: {
          tokenTTL: 3600,
          refreshTokenTTL: 86400,
        },
      },
    };

    // Platform repositories
    mockPlatformRepos = {
      [SocialPlatform.FACEBOOK]: {
        getAccountById: jest.fn().mockResolvedValue({
          id: mockAccountId,
          userId: mockUserId,
          socialAccount: {
            accessToken: mockToken,
            refreshToken: mockRefreshToken,
            expiresAt: new Date(),
          },
        }),
        createAccount: jest.fn().mockResolvedValue({
          id: mockAccountId,
          userId: mockUserId,
        }),
        updateAccountTokens: jest.fn().mockResolvedValue({}),
      },
      [SocialPlatform.INSTAGRAM]: {
        getAccountById: jest.fn().mockResolvedValue({
          id: mockAccountId,
          userId: mockUserId,
          socialAccount: {
            accessToken: mockToken,
            refreshToken: mockRefreshToken,
            expiresAt: new Date(),
          },
        }),
        createAccount: jest.fn().mockResolvedValue({
          id: mockAccountId,
          userId: mockUserId,
        }),
        updateAccountTokens: jest.fn().mockResolvedValue({}),
      },
      [SocialPlatform.LINKEDIN]: {
        getAccountById: jest.fn().mockResolvedValue({
          id: mockAccountId,
          userId: mockUserId,
          socialAccount: {
            accessToken: mockToken,
            refreshToken: mockRefreshToken,
            expiresAt: new Date(),
          },
        }),
        createAccount: jest.fn().mockResolvedValue({
          id: mockAccountId,
          userId: mockUserId,
        }),
        updateAccountTokens: jest.fn().mockResolvedValue({}),
      },
      [SocialPlatform.TIKTOK]: {
        getAccountById: jest.fn().mockResolvedValue({
          id: mockAccountId,
          userId: mockUserId,
          socialAccount: {
            accessToken: mockToken,
            refreshToken: mockRefreshToken,
            expiresAt: new Date(),
          },
        }),
        createAccount: jest.fn().mockResolvedValue({
          id: mockAccountId,
          userId: mockUserId,
        }),
        updateAccountTokens: jest.fn().mockResolvedValue({}),
      },
    };

    // Token cache service
    const mockTokenCacheService = {
      storeState: jest.fn().mockResolvedValue(undefined),
      getStoredState: jest.fn().mockResolvedValue({
        platform: SocialPlatform.FACEBOOK,
        userId: mockUserId,
      }),
      generateKey: jest.fn().mockReturnValue('cache_key'),
      getToken: jest.fn().mockResolvedValue(null),
      setToken: jest.fn().mockResolvedValue(undefined),
      deleteToken: jest.fn().mockResolvedValue(undefined),
    };

    // Tenant service mock
    const mockTenantService = {
      getTenantId: jest.fn().mockReturnValue(mockTenantId),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformAuthService,
        {
          provide: PinoLogger,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            setContext: jest.fn(),
          },
        },
        {
          provide: TokenCacheService,
          useValue: mockTokenCacheService,
        },
        {
          provide: 'PLATFORM_CONFIGS',
          useValue: mockPlatformConfigs,
        },
        {
          provide: 'PLATFORM_REPOSITORIES',
          useValue: mockPlatformRepos,
        },
        {
          provide: TenantService,
          useValue: mockTenantService,
        },
      ],
    }).compile();

    service = module.get<PlatformAuthService>(PlatformAuthService);
    tokenCacheService = module.get(
      TokenCacheService,
    ) as jest.Mocked<TokenCacheService>;
    logger = module.get<PinoLogger>(PinoLogger);
    tenantService = module.get(TenantService) as jest.Mocked<TenantService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL for Facebook', async () => {
      const result = await service.getAuthorizationUrl(
        SocialPlatform.FACEBOOK,
        mockUserId,
      );

      expect(result).toBe('https://example.com/auth');
      expect(tokenCacheService.storeState).toHaveBeenCalledWith(mockState, {
        platform: SocialPlatform.FACEBOOK,
        userId: mockUserId,
      });
      expect(mockAuthorizationCode.authorizeURL).toHaveBeenCalledWith({
        redirect_uri: mockPlatformConfigs[SocialPlatform.FACEBOOK].redirectUri,
        scope: mockPlatformConfigs[SocialPlatform.FACEBOOK].scopes,
        state: mockState,
      });
    });

    it('should add client_key for TikTok authorization URL', async () => {
      await service.getAuthorizationUrl(SocialPlatform.TIKTOK, mockUserId);

      expect(mockAuthorizationCode.authorizeURL).toHaveBeenCalledWith({
        redirect_uri: mockPlatformConfigs[SocialPlatform.TIKTOK].redirectUri,
        scope: mockPlatformConfigs[SocialPlatform.TIKTOK].scopes,
        state: mockState,
        client_key: mockPlatformConfigs[SocialPlatform.TIKTOK].clientId,
      });
    });

    it('should throw PlatformError when authorization URL generation fails', async () => {
      mockAuthorizationCode.authorizeURL.mockImplementationOnce(() => {
        throw new Error('Authorization error');
      });

      await expect(
        service.getAuthorizationUrl(SocialPlatform.FACEBOOK, mockUserId),
      ).rejects.toThrow(PlatformError);
    });
  });

  describe('handleCallback', () => {
    beforeEach(() => {
      // Mock user info fetched from social platforms
      mockAxios.get.mockImplementation((url) => {
        if (url.includes('graph.facebook.com/me')) {
          return Promise.resolve({
            data: {
              id: 'fb_user_123',
              name: 'Test User',
              email: 'test@example.com',
            },
          });
        } else if (url.includes('graph.instagram.com/me')) {
          return Promise.resolve({
            data: { id: 'ig_user_123', username: 'testuser' },
          });
        } else if (url.includes('api.linkedin.com/v2/me')) {
          return Promise.resolve({
            data: {
              id: 'li_user_123',
              localizedFirstName: 'Test',
              localizedLastName: 'User',
            },
          });
        } else if (url.includes('open-api.tiktok.com/user/info/')) {
          return Promise.resolve({
            data: {
              open_id: 'tt_user_123',
              display_name: 'TikTok User',
              avatar_url: 'https://example.com/avatar.jpg',
            },
          });
        }
        return Promise.resolve({ data: { access_token: 'new_token' } });
      });
    });

    it('should throw UnauthorizedException when state is invalid', async () => {
      tokenCacheService.getStoredState.mockResolvedValueOnce(null);

      await expect(
        service.handleCallback(SocialPlatform.FACEBOOK, mockCode, mockState),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return cached token if available', async () => {
      const cachedToken = {
        accessToken: 'cached_token',
        refreshToken: 'cached_refresh',
        expiresIn: 3600,
        tokenType: 'Bearer',
        scope: ['read', 'write'],
      };

      tokenCacheService.getToken.mockResolvedValueOnce(cachedToken);

      const result = await service.handleCallback(
        SocialPlatform.FACEBOOK,
        mockCode,
        mockState,
      );

      expect(result).toEqual(cachedToken);
      expect(
        mockPlatformRepos[SocialPlatform.FACEBOOK].createAccount,
      ).toHaveBeenCalled();
      expect(mockAuthorizationCode.getToken).not.toHaveBeenCalled();
    });

    it('should exchange code for tokens for Facebook', async () => {
      // For Facebook, we use axios directly instead of mockAuthorizationCode.getToken
      mockAxios.get.mockImplementationOnce((url) => {
        if (url.includes('oauth/access_token')) {
          return Promise.resolve({
            data: {
              access_token: 'fb_access_token',
              expires_in: 3600,
            },
          });
        }
        return Promise.resolve({
          data: {
            id: 'fb_user_123',
            name: 'Test User',
            email: 'test@example.com',
          },
        });
      });

      await service.handleCallback(
        SocialPlatform.FACEBOOK,
        mockCode,
        mockState,
      );

      // Verify axios was called for Facebook token exchange
      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/oauth/access_token',
        expect.any(Object),
      );

      // Verify user info was fetched
      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://graph.facebook.com/me',
        expect.any(Object),
      );

      // Verify account was created with the correct data
      expect(
        mockPlatformRepos[SocialPlatform.FACEBOOK].createAccount,
      ).toHaveBeenCalled();

      // Verify token is cached
      expect(tokenCacheService.setToken).toHaveBeenCalledWith(
        'cache_key',
        expect.any(Object),
        mockPlatformConfigs[SocialPlatform.FACEBOOK].cacheOptions.tokenTTL,
      );
    });

    it('should throw PlatformError when token exchange fails', async () => {
      mockAuthorizationCode.getToken.mockImplementationOnce(() => {
        throw new Error('Token exchange error');
      });

      await expect(
        service.handleCallback(SocialPlatform.INSTAGRAM, mockCode, mockState),
      ).rejects.toThrow(PlatformError);
    });
  });

  describe('refreshToken', () => {
    it('should throw NotFoundException when account not found', async () => {
      mockPlatformRepos[
        SocialPlatform.FACEBOOK
      ].getAccountById.mockResolvedValueOnce(null);

      await expect(
        service.refreshToken(SocialPlatform.FACEBOOK, mockAccountId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should refresh Facebook token', async () => {
      await service.refreshToken(SocialPlatform.FACEBOOK, mockAccountId);

      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/oauth/access_token',
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: mockPlatformConfigs[SocialPlatform.FACEBOOK].clientId,
            client_secret:
              mockPlatformConfigs[SocialPlatform.FACEBOOK].clientSecret,
            fb_exchange_token: mockRefreshToken,
          },
          headers: {
            Accept: 'application/json',
          },
        },
      );

      expect(
        mockPlatformRepos[SocialPlatform.FACEBOOK].updateAccountTokens,
      ).toHaveBeenCalled();
      expect(tokenCacheService.setToken).toHaveBeenCalled();
    });

    it('should refresh LinkedIn token', async () => {
      await service.refreshToken(SocialPlatform.LINKEDIN, mockAccountId);

      expect(mockAuthorizationCode.createToken).toHaveBeenCalledWith({
        refresh_token: mockRefreshToken,
      });
      expect(
        mockPlatformRepos[SocialPlatform.LINKEDIN].updateAccountTokens,
      ).toHaveBeenCalled();
    });

    it('should refresh TikTok token', async () => {
      await service.refreshToken(SocialPlatform.TIKTOK, mockAccountId);

      const config = mockPlatformConfigs[SocialPlatform.TIKTOK];
      expect(mockAxios.post).toHaveBeenCalledWith(
        config.tokenHost + config.tokenPath,
        {
          client_key: config.clientId,
          client_secret: config.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: mockRefreshToken,
        },
      );

      expect(
        mockPlatformRepos[SocialPlatform.TIKTOK].updateAccountTokens,
      ).toHaveBeenCalled();
    });

    it('should throw PlatformError when refresh fails', async () => {
      mockAxios.get.mockRejectedValueOnce(new Error('Refresh error'));

      await expect(
        service.refreshToken(SocialPlatform.FACEBOOK, mockAccountId),
      ).rejects.toThrow(PlatformError);
    });
  });

  describe('revokeToken', () => {
    it('should revoke token and clear from cache', async () => {
      await service.revokeToken(SocialPlatform.FACEBOOK, mockToken);

      expect(mockAuthorizationCode.createToken).toHaveBeenCalledWith({
        access_token: mockToken,
      });
      expect(mockAuthorizationCode.createToken().revoke).toHaveBeenCalledWith(
        'access_token',
      );

      expect(tokenCacheService.deleteToken).toHaveBeenCalledTimes(2);
    });

    it('should throw PlatformError when revoke fails', async () => {
      mockAuthorizationCode
        .createToken()
        .revoke.mockRejectedValueOnce(new Error('Revoke error'));

      await expect(
        service.revokeToken(SocialPlatform.FACEBOOK, mockToken),
      ).rejects.toThrow(PlatformError);
    });
  });

  describe('formatTokenResponse', () => {
    it('should handle null scope', async () => {
      mockAuthorizationCode.getToken.mockResolvedValueOnce({
        token: {
          access_token: mockToken,
          refresh_token: mockRefreshToken,
          expires_in: 3600,
          token_type: 'Bearer',
          // No scope
        },
      });

      const result = await service.handleCallback(
        SocialPlatform.LINKEDIN,
        mockCode,
        mockState,
      );

      expect(result.scope).toEqual([]);
    });
  });

  describe('getPlatformScopes', () => {
    it('should return scopes for a platform', () => {
      const scopes = service.getPlatformScopes(SocialPlatform.FACEBOOK);
      expect(scopes).toEqual(
        mockPlatformConfigs[SocialPlatform.FACEBOOK].scopes,
      );
    });

    it('should return empty array for unknown platform', () => {
      const invalidPlatform = 'UNKNOWN' as SocialPlatform;
      const scopes = service.getPlatformScopes(invalidPlatform);
      expect(scopes).toEqual([]);
    });

    it('should return empty array when platform has no scopes', () => {
      const platformWithNoScopes = { ...mockPlatformConfigs };
      delete platformWithNoScopes[SocialPlatform.FACEBOOK].scopes;

      // Create a new service instance with the modified configs
      const newService = new PlatformAuthService(
        tokenCacheService,
        platformWithNoScopes,
        mockPlatformRepos,
        logger,
        tenantService,
      );

      const scopes = newService.getPlatformScopes(SocialPlatform.FACEBOOK);
      expect(scopes).toEqual([]);
    });
  });

  describe('createPlatformAccount', () => {
    it('should create a Facebook account with correct data', async () => {
      // Implementation specific test for the createPlatformAccount method
      // We need to expose this method for testing or test it through handleCallback

      // Testing through handleCallback
      mockAxios.get.mockImplementation((url) => {
        if (url.includes('graph.facebook.com/me')) {
          return Promise.resolve({
            data: {
              id: 'fb_user_123',
              name: 'Test User',
              email: 'test@example.com',
            },
          });
        }
        return Promise.resolve({
          data: { access_token: 'new_fb_token', expires_in: 3600 },
        });
      });

      await service.handleCallback(
        SocialPlatform.FACEBOOK,
        mockCode,
        mockState,
      );

      const expectedAccountData = expect.objectContaining({
        userId: mockUserId,
        tenantId: mockTenantId,
        socialAccount: expect.objectContaining({
          platform: SocialPlatform.FACEBOOK,
          accessToken: expect.any(String),
        }),
        facebookUserId: 'fb_user_123',
        name: 'Test User',
        email: 'test@example.com',
      });

      expect(
        mockPlatformRepos[SocialPlatform.FACEBOOK].createAccount,
      ).toHaveBeenCalledWith(expectedAccountData);
    });
  });
});
