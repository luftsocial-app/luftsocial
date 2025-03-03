import { Test, TestingModule } from '@nestjs/testing';
import { PlatformsService } from './platforms.service';
import { FacebookService } from './facebook/facebook.service';
import { SocialPlatform } from '../common/enums/social-platform.enum';

describe('PlatformsService', () => {
  let service: PlatformsService;
  let facebookService: jest.Mocked<FacebookService>;

  // Mock data
  const mockUserId = 'user123';
  const mockFacebookAccount = {
    id: 'fb-account-123',
    facebookUserId: 'fb-user-123',
    // Add other properties as needed
  };

  beforeEach(async () => {
    // Create mock implementations
    const mockFacebookServiceFactory = () => ({
      getAccountsByUserId: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformsService,
        {
          provide: FacebookService,
          useFactory: mockFacebookServiceFactory,
        },
      ],
    }).compile();

    service = module.get<PlatformsService>(PlatformsService);
    facebookService = module.get(
      FacebookService,
    ) as jest.Mocked<FacebookService>;

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

    it('should throw error for unsupported platform', () => {
      // Using 'TWITTER' as an example of unsupported platform
      expect(() => {
        service.getServiceForPlatform('TWITTER' as SocialPlatform);
      }).toThrow('Unsupported platform: TWITTER');
    });
  });

  describe('getConnectedAccountsForUser', () => {
    it('should handle when no Facebook accounts are found', async () => {
      // Setup
      facebookService.getAccountsByUserId.mockResolvedValue(null);

      // Execute
      const result = await service.getConnectedAccountsForUser(mockUserId);

      // Assert
      expect(facebookService.getAccountsByUserId).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(result).toEqual({
        [SocialPlatform.FACEBOOK]: [],
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
