import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsService } from './analytics.service';
import { FacebookService } from '../../platforms/facebook/facebook.service';
import { InstagramService } from '../../platforms/instagram/instagram.service';
import { LinkedInService } from '../../platforms/linkedin/linkedin.service';
import { TikTokService } from '../../platforms/tiktok/tiktok.service';
import { AnalyticsRecord } from '../entity/analytics.entity';
import { SocialPlatform } from '../../common/enums/social-platform.enum';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let analyticsRepo: jest.Mocked<Repository<AnalyticsRecord>>;
  let facebookService: jest.Mocked<FacebookService>;
  let instagramService: jest.Mocked<InstagramService>;
  let linkedinService: jest.Mocked<LinkedInService>;
  let tiktokService: jest.Mocked<TikTokService>;

  const mockDate = new Date();
  const mockDateRange = {
    startDate: new Date(mockDate.setDate(mockDate.getDate() - 30)),
    endDate: new Date(),
  };

  const mockPlatformMetrics = {
    followers: 1000,
    engagement: 500,
    impressions: 5000,
    reach: 3000,
    platformSpecific: { someMetric: 123 },
  };

  const mockPlatformMetricsWithPosts = {
    ...mockPlatformMetrics,
    posts: [{ id: 'post1', metrics: { likes: 100, shares: 50 } }],
  };

  const mockPostMetrics = {
    likes: 100,
    shares: 50,
    comments: 25,
    reach: 1000,
    impressions: 2000,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(AnalyticsRecord),
          useValue: {
            save: jest.fn(),
          },
        },
        {
          provide: FacebookService,
          useValue: {
            getPageMetrics: jest.fn(),
            getPostMetrics: jest.fn(),
          },
        },
        {
          provide: InstagramService,
          useValue: {
            getAccountMetrics: jest.fn(),
            getPostMetrics: jest.fn(),
          },
        },
        {
          provide: LinkedInService,
          useValue: {
            getAccountMetrics: jest.fn(),
            getPostMetrics: jest.fn(),
          },
        },
        {
          provide: TikTokService,
          useValue: {
            getAccountMetrics: jest.fn(),
            getPostMetrics: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    analyticsRepo = module.get(
      getRepositoryToken(AnalyticsRecord),
    ) as jest.Mocked<Repository<AnalyticsRecord>>;
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAccountAnalytics', () => {
    const userId = 'user123';
    const facebookAccountId = 'fb123';
    const instagramAccountId = 'ig123';
    const linkedinAccountId = 'li123';
    const tiktokAccountId = 'tt123';

    beforeEach(() => {
      // Set up successful responses for each platform
      facebookService.getPageMetrics.mockResolvedValue(mockPlatformMetrics);
      instagramService.getAccountMetrics.mockResolvedValue(mockPlatformMetrics);
      linkedinService.getAccountMetrics.mockResolvedValue(
        mockPlatformMetricsWithPosts,
      );
      tiktokService.getAccountMetrics.mockResolvedValue(
        mockPlatformMetricsWithPosts,
      );

      // Set up successful repository save
      analyticsRepo.save.mockResolvedValue({} as any);
    });

    it('should fetch analytics from multiple platforms successfully', async () => {
      const result = await service.getAccountAnalytics({
        userId,
        platforms: [
          { platform: SocialPlatform.FACEBOOK, accountId: facebookAccountId },
          { platform: SocialPlatform.INSTAGRAM, accountId: instagramAccountId },
        ],
        dateRange: mockDateRange,
      });

      expect(result).toHaveLength(2);
      expect(result[0].platform).toBe(SocialPlatform.FACEBOOK);
      expect(result[0].success).toBe(true);
      expect(result[0].metrics).toEqual(mockPlatformMetrics);

      expect(result[1].platform).toBe(SocialPlatform.INSTAGRAM);
      expect(result[1].success).toBe(true);
      expect(result[1].metrics).toEqual(mockPlatformMetrics);

      expect(facebookService.getPageMetrics).toHaveBeenCalledWith(
        facebookAccountId,
        mockDateRange,
      );
      expect(instagramService.getAccountMetrics).toHaveBeenCalledWith(
        instagramAccountId,
        mockDateRange,
      );
      expect(analyticsRepo.save).toHaveBeenCalled();
    });

    it('should handle errors from individual platforms gracefully', async () => {
      // Make Facebook service throw an error
      const errorMessage = 'Facebook API error';
      facebookService.getPageMetrics.mockRejectedValue(new Error(errorMessage));

      const result = await service.getAccountAnalytics({
        userId,
        platforms: [
          { platform: SocialPlatform.FACEBOOK, accountId: facebookAccountId },
          { platform: SocialPlatform.INSTAGRAM, accountId: instagramAccountId },
        ],
        dateRange: mockDateRange,
      });

      expect(result).toHaveLength(2);

      // Facebook request failed
      expect(result[0].platform).toBe(SocialPlatform.FACEBOOK);
      expect(result[0].success).toBe(false);
      expect(result[0].error).toBe(errorMessage);

      // Instagram request succeeded
      expect(result[1].platform).toBe(SocialPlatform.INSTAGRAM);
      expect(result[1].success).toBe(true);
      expect(result[1].metrics).toEqual(mockPlatformMetrics);

      // Analytics should still be saved
      expect(analyticsRepo.save).toHaveBeenCalled();
    });

    it('should handle empty platforms array', async () => {
      const result = await service.getAccountAnalytics({
        userId,
        platforms: [],
        dateRange: mockDateRange,
      });

      expect(result).toEqual([]);
      expect(analyticsRepo.save).toHaveBeenCalledWith({
        userId,
        dateRange: mockDateRange,
        platforms: [],
        results: [],
      });
    });

    it('should properly handle LinkedIn metrics with posts field', async () => {
      const result = await service.getAccountAnalytics({
        userId,
        platforms: [
          { platform: SocialPlatform.LINKEDIN, accountId: linkedinAccountId },
        ],
        dateRange: mockDateRange,
      });

      expect(result).toHaveLength(1);
      expect(result[0].platform).toBe(SocialPlatform.LINKEDIN);
      expect(result[0].success).toBe(true);
      expect(result[0].metrics).toEqual(mockPlatformMetricsWithPosts);
      expect(linkedinService.getAccountMetrics).toHaveBeenCalledWith(
        linkedinAccountId,
        mockDateRange,
      );
    });

    it('should properly handle TikTok metrics with posts field', async () => {
      const result = await service.getAccountAnalytics({
        userId,
        platforms: [
          { platform: SocialPlatform.TIKTOK, accountId: tiktokAccountId },
        ],
        dateRange: mockDateRange,
      });

      expect(result).toHaveLength(1);
      expect(result[0].platform).toBe(SocialPlatform.TIKTOK);
      expect(result[0].success).toBe(true);
      expect(result[0].metrics).toEqual(mockPlatformMetricsWithPosts);
      expect(tiktokService.getAccountMetrics).toHaveBeenCalledWith(
        tiktokAccountId,
        mockDateRange,
      );
    });
  });

  describe('getPlatformAnalytics (private method test via getAccountAnalytics)', () => {
    it('should throw BadRequestException for unsupported platform', async () => {
      const invalidPlatform = 'MYSPACE' as SocialPlatform;
      const accountId = 'account123';

      const result = await service.getAccountAnalytics({
        userId: 'user123',
        platforms: [{ platform: invalidPlatform, accountId }],
        dateRange: mockDateRange,
      });

      expect(result).toHaveLength(1);
      expect(result[0].success).toBe(false);
      expect(result[0].error).toContain('Unsupported platform');
    });
  });

  describe('getContentPerformance', () => {
    const userId = 'user123';
    const facebookPostId = 'fbpost123';
    const instagramPostId = 'igpost123';
    const linkedinPostId = 'lipost123';
    const tiktokPostId = 'ttpost123';

    beforeEach(() => {
      // Set up successful responses for each platform
      facebookService.getPostMetrics.mockResolvedValue(mockPostMetrics);
      instagramService.getPostMetrics.mockResolvedValue(mockPostMetrics);
      linkedinService.getPostMetrics.mockResolvedValue(mockPostMetrics);
      tiktokService.getPostMetrics.mockResolvedValue(mockPostMetrics);
    });

    it('should fetch post metrics from multiple platforms successfully', async () => {
      const result = await service.getContentPerformance({
        userId,
        postIds: [
          { platform: SocialPlatform.FACEBOOK, postId: facebookPostId },
          { platform: SocialPlatform.INSTAGRAM, postId: instagramPostId },
        ],
      });

      expect(result).toHaveLength(2);

      expect(result[0].platform).toBe(SocialPlatform.FACEBOOK);
      expect(result[0].postId).toBe(facebookPostId);
      expect(result[0].success).toBe(true);
      expect(result[0].metrics).toEqual(mockPostMetrics);

      expect(result[1].platform).toBe(SocialPlatform.INSTAGRAM);
      expect(result[1].postId).toBe(instagramPostId);
      expect(result[1].success).toBe(true);
      expect(result[1].metrics).toEqual(mockPostMetrics);

      expect(facebookService.getPostMetrics).toHaveBeenCalledWith(
        userId,
        facebookPostId,
      );
      expect(instagramService.getPostMetrics).toHaveBeenCalledWith(
        userId,
        instagramPostId,
      );
    });

    it('should handle errors from individual post metrics gracefully', async () => {
      // Make Facebook service throw an error
      const errorMessage = 'Facebook post metrics error';
      facebookService.getPostMetrics.mockRejectedValue(new Error(errorMessage));

      const result = await service.getContentPerformance({
        userId,
        postIds: [
          { platform: SocialPlatform.FACEBOOK, postId: facebookPostId },
          { platform: SocialPlatform.INSTAGRAM, postId: instagramPostId },
        ],
      });

      expect(result).toHaveLength(2);

      // Facebook request failed
      expect(result[0].platform).toBe(SocialPlatform.FACEBOOK);
      expect(result[0].success).toBe(false);
      expect(result[0].error).toBe(errorMessage);

      // Instagram request succeeded
      expect(result[1].platform).toBe(SocialPlatform.INSTAGRAM);
      expect(result[1].success).toBe(true);
      expect(result[1].metrics).toEqual(mockPostMetrics);
    });

    it('should handle empty postIds array', async () => {
      const result = await service.getContentPerformance({
        userId,
        postIds: [],
      });

      expect(result).toEqual([]);
    });

    it('should fetch LinkedIn post metrics successfully', async () => {
      const result = await service.getContentPerformance({
        userId,
        postIds: [
          { platform: SocialPlatform.LINKEDIN, postId: linkedinPostId },
        ],
      });

      expect(result).toHaveLength(1);
      expect(result[0].platform).toBe(SocialPlatform.LINKEDIN);
      expect(result[0].postId).toBe(linkedinPostId);
      expect(result[0].success).toBe(true);
      expect(result[0].metrics).toEqual(mockPostMetrics);
      expect(linkedinService.getPostMetrics).toHaveBeenCalledWith(
        userId,
        linkedinPostId,
      );
    });

    it('should fetch TikTok post metrics successfully', async () => {
      const result = await service.getContentPerformance({
        userId,
        postIds: [{ platform: SocialPlatform.TIKTOK, postId: tiktokPostId }],
      });

      expect(result).toHaveLength(1);
      expect(result[0].platform).toBe(SocialPlatform.TIKTOK);
      expect(result[0].postId).toBe(tiktokPostId);
      expect(result[0].success).toBe(true);
      expect(result[0].metrics).toEqual(mockPostMetrics);
      expect(tiktokService.getPostMetrics).toHaveBeenCalledWith(
        userId,
        tiktokPostId,
      );
    });
  });

  describe('getPostMetrics (private method test via getContentPerformance)', () => {
    it('should throw BadRequestException for unsupported platform', async () => {
      const invalidPlatform = 'MYSPACE' as SocialPlatform;
      const postId = 'post123';

      const result = await service.getContentPerformance({
        userId: 'user123',
        postIds: [{ platform: invalidPlatform, postId }],
      });

      expect(result).toHaveLength(1);
      expect(result[0].success).toBe(false);
      expect(result[0].error).toContain('Unsupported platform');
    });
  });

  // Test individual platform analytics methods indirectly through getAccountAnalytics
  describe('Platform-specific analytics methods', () => {
    const userId = 'user123';

    it('should call getFacebookAnalytics with correct parameters', async () => {
      const accountId = 'fb123';

      await service.getAccountAnalytics({
        userId,
        platforms: [{ platform: SocialPlatform.FACEBOOK, accountId }],
        dateRange: mockDateRange,
      });

      expect(facebookService.getPageMetrics).toHaveBeenCalledWith(
        accountId,
        mockDateRange,
      );
    });

    it('should call getInstagramAnalytics with correct parameters', async () => {
      const accountId = 'ig123';

      await service.getAccountAnalytics({
        userId,
        platforms: [{ platform: SocialPlatform.INSTAGRAM, accountId }],
        dateRange: mockDateRange,
      });

      expect(instagramService.getAccountMetrics).toHaveBeenCalledWith(
        accountId,
        mockDateRange,
      );
    });

    it('should call getLinkedInAnalytics with correct parameters', async () => {
      const accountId = 'li123';

      await service.getAccountAnalytics({
        userId,
        platforms: [{ platform: SocialPlatform.LINKEDIN, accountId }],
        dateRange: mockDateRange,
      });

      expect(linkedinService.getAccountMetrics).toHaveBeenCalledWith(
        accountId,
        mockDateRange,
      );
    });

    it('should call getTikTokAnalytics with correct parameters', async () => {
      const accountId = 'tt123';

      await service.getAccountAnalytics({
        userId,
        platforms: [{ platform: SocialPlatform.TIKTOK, accountId }],
        dateRange: mockDateRange,
      });

      expect(tiktokService.getAccountMetrics).toHaveBeenCalledWith(
        accountId,
        mockDateRange,
      );
    });
  });
});
