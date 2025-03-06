import { Test, TestingModule } from '@nestjs/testing';
import { PlatformsService } from './platforms.service';
import { FacebookService } from './facebook/facebook.service';
import { SocialPlatform } from '../common/enums/social-platform.enum';
import { InstagramService } from './instagram/instagram.service';
import { LinkedInService } from './linkedin/linkedin.service';
import { TikTokService } from './tiktok/tiktok.service';

describe('PlatformsService', () => {
  let service: PlatformsService;
  let facebookService: jest.Mocked<FacebookService>;
  let instagramService: jest.Mocked<InstagramService>;
  let linkedinService: jest.Mocked<LinkedInService>;
  let tiktokService: jest.Mocked<TikTokService>;

  // Mock data
  const mockUserId = 'user123';
  const mockFacebookAccount = {
    id: 'fb-account-123',
    facebookUserId: 'fb-user-123',
  };
  const mockInstagramAccount = {
    id: 'ig-account-123',
    instagramUserId: 'ig-user-123',
  };
  const mockLinkedInAccount = {
    id: 'li-account-123',
    linkedInUserId: 'li-user-123',
  };
  const mockTikTokAccount = {
    id: 'tt-account-123',
    tiktokUserId: 'tt-user-123',
  };

  beforeEach(async () => {
    // Create mock implementations
    const mockFacebookServiceFactory = () => ({
      getAccountsByUserId: jest.fn(),
    });

    const mockInstagramServiceFactory = () => ({
      getAccountsByUserId: jest.fn(),
    });

    const mockLinkedInServiceFactory = () => ({
      getAccountsByUserId: jest.fn(),
    });

    const mockTikTokServiceFactory = () => ({
      getAccountsByUserId: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformsService,
        {
          provide: FacebookService,
          useFactory: mockFacebookServiceFactory,
        },
        {
          provide: InstagramService,
          useFactory: mockInstagramServiceFactory,
        },
        {
          provide: LinkedInService,
          useFactory: mockLinkedInServiceFactory,
        },
        {
          provide: TikTokService,
          useFactory: mockTikTokServiceFactory,
        },
      ],
    }).compile();

    service = module.get<PlatformsService>(PlatformsService);
    facebookService = module.get(
      FacebookService,
    ) as jest.Mocked<FacebookService>;
    instagramService = module.get(
      InstagramService,
    ) as jest.Mocked<InstagramService>;
    linkedinService = module.get(
      LinkedInService,
    ) as jest.Mocked<LinkedInService>;
    tiktokService = module.get(TikTokService) as jest.Mocked<TikTokService>;

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getServiceForPlatform', () => {
    it('should return Facebook service for FACEBOOK platform', () => {
      const result = service.getServiceForPlatform(SocialPlatform.FACEBOOK);
      expect(result).toBe(facebookService);
    });

    it('should return Instagram service for INSTAGRAM platform', () => {
      const result = service.getServiceForPlatform(SocialPlatform.INSTAGRAM);
      expect(result).toBe(instagramService);
    });

    it('should return LinkedIn service for LINKEDIN platform', () => {
      const result = service.getServiceForPlatform(SocialPlatform.LINKEDIN);
      expect(result).toBe(linkedinService);
    });

    it('should return TikTok service for TIKTOK platform', () => {
      const result = service.getServiceForPlatform(SocialPlatform.TIKTOK);
      expect(result).toBe(tiktokService);
    });

    it('should throw error for unsupported platform', () => {
      expect(() => {
        service.getServiceForPlatform('TWITTER' as SocialPlatform);
      }).toThrow('Unsupported platform: TWITTER');
    });
  });

  describe('getConnectedAccountsForUser', () => {
    it('should handle when no accounts are found', async () => {
      // Setup
      facebookService.getAccountsByUserId.mockResolvedValue(null);
      instagramService.getAccountsByUserId.mockResolvedValue(null);
      linkedinService.getAccountsByUserId.mockResolvedValue(null);
      tiktokService.getAccountsByUserId.mockResolvedValue(null);

      // Execute
      const result = await service.getConnectedAccountsForUser(mockUserId);

      // Assert
      expect(facebookService.getAccountsByUserId).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(instagramService.getAccountsByUserId).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(linkedinService.getAccountsByUserId).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(tiktokService.getAccountsByUserId).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(result).toEqual({
        [SocialPlatform.FACEBOOK]: [],
        [SocialPlatform.INSTAGRAM]: [],
        [SocialPlatform.LINKEDIN]: [],
        [SocialPlatform.TIKTOK]: [],
      });
    });

    it('should handle when accounts are already arrays', async () => {
      // Setup
      const facebookAccountsArray = [
        mockFacebookAccount,
        { ...mockFacebookAccount, id: 'fb-account-456' },
      ];
      const instagramAccountsArray = [
        mockInstagramAccount,
        { ...mockInstagramAccount, id: 'ig-account-456' },
      ];
      const linkedinAccountsArray = [
        mockLinkedInAccount,
        { ...mockLinkedInAccount, id: 'li-account-456' },
      ];
      const tiktokAccountsArray = [
        mockTikTokAccount,
        { ...mockTikTokAccount, id: 'tt-account-456' },
      ];

      facebookService.getAccountsByUserId.mockResolvedValue(
        facebookAccountsArray,
      );
      instagramService.getAccountsByUserId.mockResolvedValue(
        instagramAccountsArray,
      );
      linkedinService.getAccountsByUserId.mockResolvedValue(
        linkedinAccountsArray,
      );
      tiktokService.getAccountsByUserId.mockResolvedValue(tiktokAccountsArray);

      // Execute
      const result = await service.getConnectedAccountsForUser(mockUserId);

      // Assert
      expect(facebookService.getAccountsByUserId).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(instagramService.getAccountsByUserId).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(linkedinService.getAccountsByUserId).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(tiktokService.getAccountsByUserId).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(result).toEqual({
        [SocialPlatform.FACEBOOK]: facebookAccountsArray,
        [SocialPlatform.INSTAGRAM]: instagramAccountsArray,
        [SocialPlatform.LINKEDIN]: linkedinAccountsArray,
        [SocialPlatform.TIKTOK]: tiktokAccountsArray,
      });
    });

    it('should handle when some services return single objects instead of arrays', async () => {
      // Setup
      facebookService.getAccountsByUserId.mockResolvedValue(
        mockFacebookAccount,
      );
      instagramService.getAccountsByUserId.mockResolvedValue(null);
      linkedinService.getAccountsByUserId.mockResolvedValue(
        mockLinkedInAccount,
      );
      tiktokService.getAccountsByUserId.mockResolvedValue(mockTikTokAccount);

      // Execute
      const result = await service.getConnectedAccountsForUser(mockUserId);

      // Assert
      expect(result).toEqual({
        [SocialPlatform.FACEBOOK]: [],
        [SocialPlatform.INSTAGRAM]: [],
        [SocialPlatform.LINKEDIN]: [],
        [SocialPlatform.TIKTOK]: [],
      });
    });

    it('should handle mix of array and non-array results', async () => {
      // Setup
      const facebookAccountsArray = [
        mockFacebookAccount,
        { ...mockFacebookAccount, id: 'fb-account-456' },
      ];
      const linkedinAccountsArray = [
        mockLinkedInAccount,
        { ...mockLinkedInAccount, id: 'li-account-456' },
      ];

      facebookService.getAccountsByUserId.mockResolvedValue(
        facebookAccountsArray,
      );
      instagramService.getAccountsByUserId.mockResolvedValue(
        mockInstagramAccount,
      );
      linkedinService.getAccountsByUserId.mockResolvedValue(
        linkedinAccountsArray,
      );
      tiktokService.getAccountsByUserId.mockResolvedValue(null);

      // Execute
      const result = await service.getConnectedAccountsForUser(mockUserId);

      // Assert
      expect(result).toEqual({
        [SocialPlatform.FACEBOOK]: facebookAccountsArray,
        [SocialPlatform.INSTAGRAM]: [],
        [SocialPlatform.LINKEDIN]: linkedinAccountsArray,
        [SocialPlatform.TIKTOK]: [],
      });
    });

    it('should handle errors from Facebook service', async () => {
      // Setup
      facebookService.getAccountsByUserId.mockRejectedValue(
        new Error('Facebook API error'),
      );
      instagramService.getAccountsByUserId.mockResolvedValue([]);
      linkedinService.getAccountsByUserId.mockResolvedValue([]);
      tiktokService.getAccountsByUserId.mockResolvedValue([]);

      // Execute and Assert
      await expect(
        service.getConnectedAccountsForUser(mockUserId),
      ).rejects.toThrow('Facebook API error');
    });

    it('should handle errors from Instagram service', async () => {
      // Setup
      facebookService.getAccountsByUserId.mockResolvedValue([]);
      instagramService.getAccountsByUserId.mockRejectedValue(
        new Error('Instagram API error'),
      );
      linkedinService.getAccountsByUserId.mockResolvedValue([]);
      tiktokService.getAccountsByUserId.mockResolvedValue([]);

      // Execute and Assert
      await expect(
        service.getConnectedAccountsForUser(mockUserId),
      ).rejects.toThrow('Instagram API error');
    });

    it('should handle errors from LinkedIn service', async () => {
      // Setup
      facebookService.getAccountsByUserId.mockResolvedValue([]);
      instagramService.getAccountsByUserId.mockResolvedValue([]);
      linkedinService.getAccountsByUserId.mockRejectedValue(
        new Error('LinkedIn API error'),
      );
      tiktokService.getAccountsByUserId.mockResolvedValue([]);

      // Execute and Assert
      await expect(
        service.getConnectedAccountsForUser(mockUserId),
      ).rejects.toThrow('LinkedIn API error');
    });

    it('should handle errors from TikTok service', async () => {
      // Setup
      facebookService.getAccountsByUserId.mockResolvedValue([]);
      instagramService.getAccountsByUserId.mockResolvedValue([]);
      linkedinService.getAccountsByUserId.mockResolvedValue([]);
      tiktokService.getAccountsByUserId.mockRejectedValue(
        new Error('TikTok API error'),
      );

      // Execute and Assert
      await expect(
        service.getConnectedAccountsForUser(mockUserId),
      ).rejects.toThrow('TikTok API error');
    });
  });
});
