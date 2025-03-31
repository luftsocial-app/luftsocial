import { Test, TestingModule } from '@nestjs/testing';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthService } from './platform-auth.service';
import { SocialPlatform } from '../common/enums/social-platform.enum';
import { TokenResponse } from '../platforms/platform-service.interface';

describe('PlatformAuthController', () => {
  let controller: PlatformAuthController;
  let platformAuthService: jest.Mocked<PlatformAuthService>;

  const mockUser = { userId: 'user123' };
  const mockCode = 'auth_code_123';
  const mockState = 'random_state_123';
  const mockToken = 'access_token_123';

  // Mock token response
  const mockTokenResponse: TokenResponse = {
    accessToken: mockToken,
    refreshToken: 'refresh_token_123',
    expiresIn: 3600,
    tokenType: 'Bearer',
    scope: ['read', 'write'],
  };

  beforeEach(async () => {
    // Create mock PlatformAuthService
    const mockPlatformAuthService = {
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
          provide: PlatformAuthService,
          useValue: mockPlatformAuthService,
        },
      ],
    }).compile();

    controller = module.get<PlatformAuthController>(PlatformAuthController);
    platformAuthService = module.get(
      PlatformAuthService,
    ) as jest.Mocked<PlatformAuthService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('authorize', () => {
    it('should return authorization URL for Facebook', async () => {
      const result = await controller.authorize(
        SocialPlatform.FACEBOOK,
        mockUser,
      );

      expect(platformAuthService.getAuthorizationUrl).toHaveBeenCalledWith(
        SocialPlatform.FACEBOOK,
        mockUser.userId,
      );

      expect(result).toEqual({ url: 'https://example.com/auth' });
    });

    it('should return authorization URL for Instagram', async () => {
      const result = await controller.authorize(
        SocialPlatform.INSTAGRAM,
        mockUser,
      );

      expect(platformAuthService.getAuthorizationUrl).toHaveBeenCalledWith(
        SocialPlatform.INSTAGRAM,
        mockUser.userId,
      );

      expect(result).toEqual({ url: 'https://example.com/auth' });
    });

    it('should return authorization URL for LinkedIn', async () => {
      const result = await controller.authorize(
        SocialPlatform.LINKEDIN,
        mockUser,
      );

      expect(platformAuthService.getAuthorizationUrl).toHaveBeenCalledWith(
        SocialPlatform.LINKEDIN,
        mockUser.userId,
      );

      expect(result).toEqual({ url: 'https://example.com/auth' });
    });

    it('should return authorization URL for TikTok', async () => {
      const result = await controller.authorize(
        SocialPlatform.TIKTOK,
        mockUser,
      );

      expect(platformAuthService.getAuthorizationUrl).toHaveBeenCalledWith(
        SocialPlatform.TIKTOK,
        mockUser.userId,
      );

      expect(result).toEqual({ url: 'https://example.com/auth' });
    });

    it('should propagate errors from PlatformAuthService', async () => {
      const errorMessage = 'Failed to generate authorization URL';
      platformAuthService.getAuthorizationUrl.mockRejectedValueOnce(
        new Error(errorMessage),
      );

      await expect(
        controller.authorize(SocialPlatform.FACEBOOK, mockUser),
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

      expect(platformAuthService.handleCallback).toHaveBeenCalledWith(
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

      expect(platformAuthService.handleCallback).toHaveBeenCalledWith(
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

      expect(platformAuthService.handleCallback).toHaveBeenCalledWith(
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

      expect(platformAuthService.handleCallback).toHaveBeenCalledWith(
        SocialPlatform.TIKTOK,
        mockCode,
        mockState,
      );

      expect(result).toEqual(mockTokenResponse);
    });

    it('should propagate errors from PlatformAuthService', async () => {
      const errorMessage = 'Failed to exchange code for token';
      platformAuthService.handleCallback.mockRejectedValueOnce(
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
        mockUser,
      );

      expect(platformAuthService.refreshToken).toHaveBeenCalledWith(
        SocialPlatform.FACEBOOK,
        mockUser.userId,
      );

      expect(result).toEqual(mockTokenResponse);
    });

    it('should refresh token for Instagram', async () => {
      const result = await controller.refreshToken(
        SocialPlatform.INSTAGRAM,
        mockUser,
      );

      expect(platformAuthService.refreshToken).toHaveBeenCalledWith(
        SocialPlatform.INSTAGRAM,
        mockUser.userId,
      );

      expect(result).toEqual(mockTokenResponse);
    });

    it('should refresh token for LinkedIn', async () => {
      const result = await controller.refreshToken(
        SocialPlatform.LINKEDIN,
        mockUser,
      );

      expect(platformAuthService.refreshToken).toHaveBeenCalledWith(
        SocialPlatform.LINKEDIN,
        mockUser.userId,
      );

      expect(result).toEqual(mockTokenResponse);
    });

    it('should refresh token for TikTok', async () => {
      const result = await controller.refreshToken(
        SocialPlatform.TIKTOK,
        mockUser,
      );

      expect(platformAuthService.refreshToken).toHaveBeenCalledWith(
        SocialPlatform.TIKTOK,
        mockUser.userId,
      );

      expect(result).toEqual(mockTokenResponse);
    });

    it('should propagate errors from PlatformAuthService', async () => {
      const errorMessage = 'Failed to refresh token';
      platformAuthService.refreshToken.mockRejectedValueOnce(
        new Error(errorMessage),
      );

      await expect(
        controller.refreshToken(SocialPlatform.FACEBOOK, mockUser),
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('revokeToken', () => {
    it('should revoke token for Facebook', async () => {
      await controller.revokeToken(SocialPlatform.FACEBOOK, mockToken);

      expect(platformAuthService.revokeToken).toHaveBeenCalledWith(
        SocialPlatform.FACEBOOK,
        mockToken,
      );
    });

    it('should revoke token for Instagram', async () => {
      await controller.revokeToken(SocialPlatform.INSTAGRAM, mockToken);

      expect(platformAuthService.revokeToken).toHaveBeenCalledWith(
        SocialPlatform.INSTAGRAM,
        mockToken,
      );
    });

    it('should revoke token for LinkedIn', async () => {
      await controller.revokeToken(SocialPlatform.LINKEDIN, mockToken);

      expect(platformAuthService.revokeToken).toHaveBeenCalledWith(
        SocialPlatform.LINKEDIN,
        mockToken,
      );
    });

    it('should revoke token for TikTok', async () => {
      await controller.revokeToken(SocialPlatform.TIKTOK, mockToken);

      expect(platformAuthService.revokeToken).toHaveBeenCalledWith(
        SocialPlatform.TIKTOK,
        mockToken,
      );
    });

    it('should propagate errors from PlatformAuthService', async () => {
      const errorMessage = 'Failed to revoke token';
      platformAuthService.revokeToken.mockRejectedValueOnce(
        new Error(errorMessage),
      );

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
