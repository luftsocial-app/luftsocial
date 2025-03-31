import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CrossPlatformService } from './cross-platform.service';
import { FacebookService } from '../platforms/facebook/facebook.service';
import { InstagramService } from '../platforms/instagram/instagram.service';
import { LinkedInService } from '../platforms/linkedin/linkedin.service';
import { TikTokService } from '../platforms/tiktok/tiktok.service';
import { SocialPlatform } from '../common/enums/social-platform.enum';
import { PinoLogger } from 'nestjs-pino';
import { SocialAccountDetails } from '../platforms/platform-service.interface';

describe('CrossPlatformService', () => {
  let service: CrossPlatformService;
  let facebookService: jest.Mocked<FacebookService>;
  let instagramService: jest.Mocked<InstagramService>;
  let linkedinService: jest.Mocked<LinkedInService>;
  let tiktokService: jest.Mocked<TikTokService>;
  let logger: PinoLogger;

  const mockUserId = 'user123';

  // Mock account responses
  const mockFacebookAccounts = [
    { id: 'fb123', name: 'My Facebook Page' },
    { id: 'fb456', name: 'Another Facebook Page' },
  ] as unknown as SocialAccountDetails[];

  const mockInstagramAccounts = [
    { id: 'ig123', name: 'My Instagram Account' },
  ] as unknown as SocialAccountDetails[];

  const mockLinkedInAccounts = [
    { id: 'li123', name: 'My LinkedIn Profile', type: 'personal' },
    { id: 'li456', name: 'Company Page', type: 'company' },
  ] as unknown as SocialAccountDetails[];

  const mockTikTokAccounts = [
    { id: 'tt123', name: 'My TikTok Account' },
  ] as unknown as SocialAccountDetails[];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrossPlatformService,
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
          provide: FacebookService,
          useValue: {
            getUserAccounts: jest.fn(),
            revokeAccess: jest.fn(),
          },
        },
        {
          provide: InstagramService,
          useValue: {
            getUserAccounts: jest.fn(),
            revokeAccess: jest.fn(),
          },
        },
        {
          provide: LinkedInService,
          useValue: {
            getUserAccounts: jest.fn(),
            revokeAccess: jest.fn(),
          },
        },
        {
          provide: TikTokService,
          useValue: {
            getUserAccounts: jest.fn(),
            revokeAccess: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CrossPlatformService>(CrossPlatformService);
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

    logger = module.get(PinoLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getConnectedPlatforms', () => {
    beforeEach(() => {
      // Set up successful responses for all platforms
      facebookService.getUserAccounts.mockResolvedValue(mockFacebookAccounts);
      instagramService.getUserAccounts.mockResolvedValue(mockInstagramAccounts);
      linkedinService.getUserAccounts.mockResolvedValue(mockLinkedInAccounts);
      tiktokService.getUserAccounts.mockResolvedValue(mockTikTokAccounts);
    });

    it('should return all connected platforms when all services return accounts', async () => {
      const result = await service.getConnectedPlatforms(mockUserId);

      expect(result).toHaveLength(4); // All 4 platforms should be included

      // Verify each platform's data
      const facebookPlatform = result.find(
        (p) => p.platform === SocialPlatform.FACEBOOK,
      );
      expect(facebookPlatform).toBeDefined();
      expect(facebookPlatform.accounts).toHaveLength(2);
      expect(facebookPlatform.accounts[0].id).toBe('fb123');
      expect(facebookPlatform.accounts[0].type).toBe('page');

      const instagramPlatform = result.find(
        (p) => p.platform === SocialPlatform.INSTAGRAM,
      );
      expect(instagramPlatform).toBeDefined();
      expect(instagramPlatform.accounts).toHaveLength(1);
      expect(instagramPlatform.accounts[0].id).toBe('ig123');
      expect(instagramPlatform.accounts[0].type).toBe('individual');

      const linkedinPlatform = result.find(
        (p) => p.platform === SocialPlatform.LINKEDIN,
      );
      expect(linkedinPlatform).toBeDefined();
      expect(linkedinPlatform.accounts).toHaveLength(2);
      expect(linkedinPlatform.accounts[0].id).toBe('li123');
      expect(linkedinPlatform.accounts[0].type).toBe('personal');
      expect(linkedinPlatform.accounts[1].type).toBe('company');

      const tiktokPlatform = result.find(
        (p) => p.platform === SocialPlatform.TIKTOK,
      );
      expect(tiktokPlatform).toBeDefined();
      expect(tiktokPlatform.accounts).toHaveLength(1);
      expect(tiktokPlatform.accounts[0].id).toBe('tt123');
      expect(tiktokPlatform.accounts[0].type).toBe('page');

      // Verify service calls
      expect(facebookService.getUserAccounts).toHaveBeenCalledWith(mockUserId);
      expect(instagramService.getUserAccounts).toHaveBeenCalledWith(mockUserId);
      expect(linkedinService.getUserAccounts).toHaveBeenCalledWith(mockUserId);
      expect(tiktokService.getUserAccounts).toHaveBeenCalledWith(mockUserId);
    });

    it('should handle empty account lists', async () => {
      // Mock empty responses
      facebookService.getUserAccounts.mockResolvedValue([]);
      instagramService.getUserAccounts.mockResolvedValue([]);
      linkedinService.getUserAccounts.mockResolvedValue([]);
      tiktokService.getUserAccounts.mockResolvedValue([]);

      const result = await service.getConnectedPlatforms(mockUserId);

      expect(result).toHaveLength(0); // No platforms should be included
    });

    it('should handle null return values', async () => {
      // Mock null responses
      facebookService.getUserAccounts.mockResolvedValue(null);
      instagramService.getUserAccounts.mockResolvedValue(null);
      linkedinService.getUserAccounts.mockResolvedValue(null);
      tiktokService.getUserAccounts.mockResolvedValue(null);

      const result = await service.getConnectedPlatforms(mockUserId);

      expect(result).toHaveLength(0); // No platforms should be included
    });

    it('should handle errors from Facebook service', async () => {
      // Mock Facebook service error
      facebookService.getUserAccounts.mockRejectedValue(
        new Error('Facebook API error'),
      );

      // Mock Logger
      const loggerSpy = jest.spyOn(logger, 'error');

      const result = await service.getConnectedPlatforms(mockUserId);

      // Should still include the other platforms
      expect(result).toHaveLength(3);
      expect(
        result.find((p) => p.platform === SocialPlatform.FACEBOOK),
      ).toBeUndefined();
      expect(
        result.find((p) => p.platform === SocialPlatform.INSTAGRAM),
      ).toBeDefined();
      expect(
        result.find((p) => p.platform === SocialPlatform.LINKEDIN),
      ).toBeDefined();
      expect(
        result.find((p) => p.platform === SocialPlatform.TIKTOK),
      ).toBeDefined();

      // Error should be logged
      expect(loggerSpy).toHaveBeenCalledWith(
        'Error fetching Facebook accounts:',
        expect.any(Error),
      );
    });

    it('should handle errors from Instagram service', async () => {
      // Mock Instagram service error
      instagramService.getUserAccounts.mockRejectedValue(
        new Error('Instagram API error'),
      );

      // Mock Logger
      const loggerSpy = jest.spyOn(logger, 'error');

      const result = await service.getConnectedPlatforms(mockUserId);

      // Should still include the other platforms
      expect(result).toHaveLength(3);
      expect(
        result.find((p) => p.platform === SocialPlatform.FACEBOOK),
      ).toBeDefined();
      expect(
        result.find((p) => p.platform === SocialPlatform.INSTAGRAM),
      ).toBeUndefined();
      expect(
        result.find((p) => p.platform === SocialPlatform.LINKEDIN),
      ).toBeDefined();
      expect(
        result.find((p) => p.platform === SocialPlatform.TIKTOK),
      ).toBeDefined();

      // Error should be logged
      expect(loggerSpy).toHaveBeenCalledWith(
        'Error fetching instagram accounts:',
        expect.any(Error),
      );
    });

    it('should handle errors from LinkedIn service', async () => {
      // Mock LinkedIn service error
      linkedinService.getUserAccounts.mockRejectedValue(
        new Error('LinkedIn API error'),
      );

      // Mock Logger
      const loggerSpy = jest.spyOn(logger, 'error');

      const result = await service.getConnectedPlatforms(mockUserId);

      // Should still include the other platforms
      expect(result).toHaveLength(3);
      expect(
        result.find((p) => p.platform === SocialPlatform.FACEBOOK),
      ).toBeDefined();
      expect(
        result.find((p) => p.platform === SocialPlatform.INSTAGRAM),
      ).toBeDefined();
      expect(
        result.find((p) => p.platform === SocialPlatform.LINKEDIN),
      ).toBeUndefined();
      expect(
        result.find((p) => p.platform === SocialPlatform.TIKTOK),
      ).toBeDefined();

      // Error should be logged
      expect(loggerSpy).toHaveBeenCalledWith(
        'Error fetching linkedin accounts:',
        expect.any(Error),
      );
    });

    it('should handle errors from TikTok service', async () => {
      // Mock TikTok service error
      tiktokService.getUserAccounts.mockRejectedValue(
        new Error('TikTok API error'),
      );

      // Mock Logger
      const loggerSpy = jest.spyOn(logger, 'error');

      const result = await service.getConnectedPlatforms(mockUserId);

      // Should still include the other platforms
      expect(result).toHaveLength(3);
      expect(
        result.find((p) => p.platform === SocialPlatform.FACEBOOK),
      ).toBeDefined();
      expect(
        result.find((p) => p.platform === SocialPlatform.INSTAGRAM),
      ).toBeDefined();
      expect(
        result.find((p) => p.platform === SocialPlatform.LINKEDIN),
      ).toBeDefined();
      expect(
        result.find((p) => p.platform === SocialPlatform.TIKTOK),
      ).toBeUndefined();

      // Error should be logged
      expect(loggerSpy).toHaveBeenCalledWith(
        'Error fetching TikTok accounts:',
        expect.any(Error),
      );
    });

    it('should handle errors from all services and return empty array', async () => {
      // Mock errors from all services
      facebookService.getUserAccounts.mockRejectedValue(
        new Error('Facebook error'),
      );
      instagramService.getUserAccounts.mockRejectedValue(
        new Error('Instagram error'),
      );
      linkedinService.getUserAccounts.mockRejectedValue(
        new Error('LinkedIn error'),
      );
      tiktokService.getUserAccounts.mockRejectedValue(
        new Error('TikTok error'),
      );
      // Mock Logger
      const loggerSpy = jest.spyOn(logger, 'error');

      const result = await service.getConnectedPlatforms(mockUserId);

      expect(result).toHaveLength(0);
      expect(loggerSpy).toHaveBeenCalledTimes(4);
    });
  });

  describe('disconnectPlatform', () => {
    it('should call Facebook service to revoke access', async () => {
      await service.disconnectPlatform(
        mockUserId,
        SocialPlatform.FACEBOOK,
        'fb123',
      );

      expect(facebookService.revokeAccess).toHaveBeenCalledWith('fb123');
    });

    it('should call Instagram service to revoke access', async () => {
      await service.disconnectPlatform(
        mockUserId,
        SocialPlatform.INSTAGRAM,
        'ig123',
      );

      expect(instagramService.revokeAccess).toHaveBeenCalledWith('ig123');
    });

    it('should call LinkedIn service to revoke access', async () => {
      await service.disconnectPlatform(
        mockUserId,
        SocialPlatform.LINKEDIN,
        'li123',
      );

      expect(linkedinService.revokeAccess).toHaveBeenCalledWith('li123');
    });

    it('should call TikTok service to revoke access', async () => {
      await service.disconnectPlatform(
        mockUserId,
        SocialPlatform.TIKTOK,
        'tt123',
      );

      expect(tiktokService.revokeAccess).toHaveBeenCalledWith('tt123');
    });

    it('should throw BadRequestException for unsupported platform', async () => {
      const invalidPlatform = 'MYSPACE' as SocialPlatform;

      await expect(
        service.disconnectPlatform(mockUserId, invalidPlatform, 'account123'),
      ).rejects.toThrow(BadRequestException);

      expect(facebookService.revokeAccess).not.toHaveBeenCalled();
      expect(instagramService.revokeAccess).not.toHaveBeenCalled();
      expect(linkedinService.revokeAccess).not.toHaveBeenCalled();
      expect(tiktokService.revokeAccess).not.toHaveBeenCalled();
    });

    it('should propagate errors from platform services', async () => {
      const errorMessage = 'API error revoking access';
      facebookService.revokeAccess.mockRejectedValue(new Error(errorMessage));

      await expect(
        service.disconnectPlatform(
          mockUserId,
          SocialPlatform.FACEBOOK,
          'fb123',
        ),
      ).rejects.toThrow(errorMessage);
    });
  });
});
