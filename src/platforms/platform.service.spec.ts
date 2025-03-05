import { Test, TestingModule } from '@nestjs/testing';
import { PlatformsService } from './platforms.service';
import { FacebookService } from './facebook/facebook.service';
import { SocialPlatform } from '../common/enums/social-platform.enum';
import { InstagramService } from './instagram/instagram.service';

describe('PlatformsService', () => {
  let service: PlatformsService;
  let facebookService: jest.Mocked<FacebookService>;
  let instagramService: jest.Mocked<InstagramService>;

  // Mock data
  const mockUserId = 'user123';
  const mockFacebookAccount = {
    id: 'fb-account-123',
    facebookUserId: 'fb-user-123',
  };

  beforeEach(async () => {
    // Create mock implementations
    const mockFacebookServiceFactory = () => ({
      getAccountsByUserId: jest.fn(),
    });

    const mockInstagramServiceFactory = () => ({
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
      ],
    }).compile();

    service = module.get<PlatformsService>(PlatformsService);
    facebookService = module.get(
      FacebookService,
    ) as jest.Mocked<FacebookService>;
    instagramService = module.get(
      InstagramService,
    ) as jest.Mocked<InstagramService>;

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

      // Execute
      const result = await service.getConnectedAccountsForUser(mockUserId);

      // Assert
      expect(facebookService.getAccountsByUserId).toHaveBeenCalledWith(mockUserId);
      expect(instagramService.getAccountsByUserId).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual({
        [SocialPlatform.FACEBOOK]: [],
        [SocialPlatform.INSTAGRAM]: [],
      });
    });

    it('should handle when Facebook accounts are already an array', async () => {
      // Setup
      const accountsArray = [
        mockFacebookAccount,
        { ...mockFacebookAccount, id: 'fb-account-456' },
      ];
      facebookService.getAccountsByUserId.mockResolvedValue(accountsArray);

      // Execute
      const result = await service.getConnectedAccountsForUser(mockUserId);

      // Assert
      expect(facebookService.getAccountsByUserId).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(result).toEqual({
        [SocialPlatform.FACEBOOK]: accountsArray,
        [SocialPlatform.INSTAGRAM]: [],
      });
    });

    it('should handle errors from Facebook service', async () => {
      // Setup
      facebookService.getAccountsByUserId.mockRejectedValue(
        new Error('Facebook API error'),
      );

      // Execute and Assert
      await expect(
        service.getConnectedAccountsForUser(mockUserId),
      ).rejects.toThrow('Facebook API error');
    });
  });
});
