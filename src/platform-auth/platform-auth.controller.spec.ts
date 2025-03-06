import { Test, TestingModule } from '@nestjs/testing';
import { PlatformAuthController } from './platform-auth.controller';
import { OAuth2Service } from './platform-auth.service';
import { SocialPlatform } from '../common/enums/social-platform.enum';
import { TokenResponse } from '../platforms/platform-service.interface';

describe('PlatformAuthController', () => {
  let controller: PlatformAuthController;
  let oauth2Service: jest.Mocked<OAuth2Service>;

  const mockUserId = 'user123';
  const mockCode = 'auth_code_123';
  const mockState = 'random_state_123';
  const mockToken = 'access_token_123';
  const mockRefreshToken = 'refresh_token_123';

  // Mock token response
  const mockTokenResponse: TokenResponse = {
    accessToken: mockToken,
    refreshToken: mockRefreshToken,
    expiresIn: 3600,
    tokenType: 'Bearer',
    scope: ['read', 'write'],
  };

  beforeEach(async () => {
    // Create mock OAuth2Service
    const mockOAuth2Service = {
      getAuthorizationUrl: jest
        .fn()
        .mockResolvedValue('https://example.com/auth'),
      handleCallback: jest.fn().mockResolvedValue(mockTokenResponse),
      refreshToken: jest.fn().mockResolvedValue(mockTokenResponse),
      revokeToken: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformAuthController],
      providers: [
        {
          provide: OAuth2Service,
          useValue: mockOAuth2Service,
        },
      ],
    }).compile();

    controller = module.get<PlatformAuthController>(PlatformAuthController);
    oauth2Service = module.get(OAuth2Service) as jest.Mocked<OAuth2Service>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('authorize', () => {
    it('should return authorization URL for Facebook', async () => {
      const result = await controller.authorize(
        SocialPlatform.FACEBOOK,
        mockUserId,
      );

      expect(oauth2Service.getAuthorizationUrl).toHaveBeenCalledWith(
        SocialPlatform.FACEBOOK,
        mockUserId,
      );

      expect(result).toEqual({ url: 'https://example.com/auth' });
    });

    it('should return authorization URL for Instagram', async () => {
      const result = await controller.authorize(
        SocialPlatform.INSTAGRAM,
        mockUserId,
      );

      expect(oauth2Service.getAuthorizationUrl).toHaveBeenCalledWith(
        SocialPlatform.INSTAGRAM,
        mockUserId,
      );

      expect(result).toEqual({ url: 'https://example.com/auth' });
    });

    it('should return authorization URL for LinkedIn', async () => {
      const result = await controller.authorize(
        SocialPlatform.LINKEDIN,
        mockUserId,
      );

      expect(oauth2Service.getAuthorizationUrl).toHaveBeenCalledWith(
        SocialPlatform.LINKEDIN,
        mockUserId,
      );

      expect(result).toEqual({ url: 'https://example.com/auth' });
    });

    it('should return authorization URL for TikTok', async () => {
      const result = await controller.authorize(
        SocialPlatform.TIKTOK,
        mockUserId,
      );

      expect(oauth2Service.getAuthorizationUrl).toHaveBeenCalledWith(
        SocialPlatform.TIKTOK,
        mockUserId,
      );

      expect(result).toEqual({ url: 'https://example.com/auth' });
    });

    it('should propagate errors from OAuth2Service', async () => {
      const errorMessage = 'Failed to generate authorization URL';
      oauth2Service.getAuthorizationUrl.mockRejectedValueOnce(
        new Error(errorMessage),
      );

      await expect(
        controller.authorize(SocialPlatform.FACEBOOK, mockUserId),
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('handleCallback', () => {
    it('should exchange code for token for Facebook', async () => {
      const result = await controller.handleCallback(
        SocialPlatform.FACEBOOK,
        mockCode,
        mockState,
      );

      expect(oauth2Service.handleCallback).toHaveBeenCalledWith(
        SocialPlatform.FACEBOOK,
        mockCode,
        mockState,
      );

      expect(result).toEqual(mockTokenResponse);
    });

    it('should exchange code for token for Instagram', async () => {
      const result = await controller.handleCallback(
        SocialPlatform.INSTAGRAM,
        mockCode,
        mockState,
      );

      expect(oauth2Service.handleCallback).toHaveBeenCalledWith(
        SocialPlatform.INSTAGRAM,
        mockCode,
        mockState,
      );

      expect(result).toEqual(mockTokenResponse);
    });

    it('should exchange code for token for LinkedIn', async () => {
      const result = await controller.handleCallback(
        SocialPlatform.LINKEDIN,
        mockCode,
        mockState,
      );

      expect(oauth2Service.handleCallback).toHaveBeenCalledWith(
        SocialPlatform.LINKEDIN,
        mockCode,
        mockState,
      );

      expect(result).toEqual(mockTokenResponse);
    });

    it('should exchange code for token for TikTok', async () => {
      const result = await controller.handleCallback(
        SocialPlatform.TIKTOK,
        mockCode,
        mockState,
      );

      expect(oauth2Service.handleCallback).toHaveBeenCalledWith(
        SocialPlatform.TIKTOK,
        mockCode,
        mockState,
      );

      expect(result).toEqual(mockTokenResponse);
    });

    it('should propagate errors from OAuth2Service', async () => {
      const errorMessage = 'Failed to exchange code for token';
      oauth2Service.handleCallback.mockRejectedValueOnce(
        new Error(errorMessage),
      );

      await expect(
        controller.handleCallback(SocialPlatform.FACEBOOK, mockCode, mockState),
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token for Facebook', async () => {
      const result = await controller.refreshToken(
        SocialPlatform.FACEBOOK,
        mockRefreshToken,
      );

      expect(oauth2Service.refreshToken).toHaveBeenCalledWith(
        SocialPlatform.FACEBOOK,
        mockRefreshToken,
      );

      expect(result).toEqual(mockTokenResponse);
    });

    it('should refresh token for Instagram', async () => {
      const result = await controller.refreshToken(
        SocialPlatform.INSTAGRAM,
        mockRefreshToken,
      );

      expect(oauth2Service.refreshToken).toHaveBeenCalledWith(
        SocialPlatform.INSTAGRAM,
        mockRefreshToken,
      );

      expect(result).toEqual(mockTokenResponse);
    });

    it('should refresh token for LinkedIn', async () => {
      const result = await controller.refreshToken(
        SocialPlatform.LINKEDIN,
        mockRefreshToken,
      );

      expect(oauth2Service.refreshToken).toHaveBeenCalledWith(
        SocialPlatform.LINKEDIN,
        mockRefreshToken,
      );

      expect(result).toEqual(mockTokenResponse);
    });

    it('should refresh token for TikTok', async () => {
      const result = await controller.refreshToken(
        SocialPlatform.TIKTOK,
        mockRefreshToken,
      );

      expect(oauth2Service.refreshToken).toHaveBeenCalledWith(
        SocialPlatform.TIKTOK,
        mockRefreshToken,
      );

      expect(result).toEqual(mockTokenResponse);
    });

    it('should propagate errors from OAuth2Service', async () => {
      const errorMessage = 'Failed to refresh token';
      oauth2Service.refreshToken.mockRejectedValueOnce(new Error(errorMessage));

      await expect(
        controller.refreshToken(SocialPlatform.FACEBOOK, mockRefreshToken),
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('revokeToken', () => {
    it('should revoke token for Facebook', async () => {
      await controller.revokeToken(SocialPlatform.FACEBOOK, mockToken);

      expect(oauth2Service.revokeToken).toHaveBeenCalledWith(
        SocialPlatform.FACEBOOK,
        mockToken,
      );
    });

    it('should revoke token for Instagram', async () => {
      await controller.revokeToken(SocialPlatform.INSTAGRAM, mockToken);

      expect(oauth2Service.revokeToken).toHaveBeenCalledWith(
        SocialPlatform.INSTAGRAM,
        mockToken,
      );
    });

    it('should revoke token for LinkedIn', async () => {
      await controller.revokeToken(SocialPlatform.LINKEDIN, mockToken);

      expect(oauth2Service.revokeToken).toHaveBeenCalledWith(
        SocialPlatform.LINKEDIN,
        mockToken,
      );
    });

    it('should revoke token for TikTok', async () => {
      await controller.revokeToken(SocialPlatform.TIKTOK, mockToken);

      expect(oauth2Service.revokeToken).toHaveBeenCalledWith(
        SocialPlatform.TIKTOK,
        mockToken,
      );
    });

    it('should propagate errors from OAuth2Service', async () => {
      const errorMessage = 'Failed to revoke token';
      oauth2Service.revokeToken.mockRejectedValueOnce(new Error(errorMessage));

      await expect(
        controller.revokeToken(SocialPlatform.FACEBOOK, mockToken),
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('getAvailablePlatforms', () => {
    it('should return all available social platforms', () => {
      const result = controller.getAvailablePlatforms();

      expect(result).toEqual(Object.values(SocialPlatform));
    });
  });
});
