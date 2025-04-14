import { Test, TestingModule } from '@nestjs/testing';
import { CrossPlatformController } from './cross-platform.controller';
import { CrossPlatformService } from './cross-platform.service';
import { ContentPublisherService } from './services/content-publisher.service';
import { AnalyticsService } from './services/analytics.service';
import { SchedulerService } from './services/scheduler.service';
import { SocialPlatform } from '../common/enums/social-platform.enum';
import {
  PublishStatus,
  ScheduleStatus,
} from './helpers/cross-platform.interface';
import { PinoLogger } from 'nestjs-pino';

describe('CrossPlatformController', () => {
  let controller: CrossPlatformController;
  let crossPlatformService: jest.Mocked<CrossPlatformService>;
  let contentPublisherService: jest.Mocked<ContentPublisherService>;
  let analyticsService: jest.Mocked<AnalyticsService>;
  const logger: jest.Mocked<PinoLogger>;
  let schedulerService: jest.Mocked<SchedulerService>;

  const mockUserId = 'user123';
  const mockPublishId = 'publish123';
  const mockPostId = 'post123';

  // Mock DTOs
  const mockCreatePostDto = {
    content: 'Test post content',
    mediaUrls: ['https://example.com/image.jpg'],
    platforms: [{ platform: SocialPlatform.FACEBOOK, accountId: 'fb123' }],
  };

  const mockSchedulePostDto = {
    content: 'Test scheduled content',
    mediaUrls: ['https://example.com/image.jpg'],
    platforms: [{ platform: SocialPlatform.FACEBOOK, accountId: 'fb123' }],
    scheduledTime: '2023-12-31T12:00:00Z',
  };

  const mockScheduleFiltersDto = {
    status: ScheduleStatus.PENDING,
    startDate: '2023-01-01T00:00:00Z',
    endDate: '2023-12-31T23:59:59Z',
    platform: SocialPlatform.FACEBOOK,
  };

  const mockUpdateScheduleDto = {
    content: 'Updated content',
    scheduledTime: '2023-12-31T14:00:00Z',
    platforms: [
      { platform: SocialPlatform.FACEBOOK, accountId: 'fb123' },
      { platform: SocialPlatform.INSTAGRAM, accountId: 'ig123' },
    ],
  };

  const mockAnalyticsDto = {
    platforms: [{ platform: SocialPlatform.FACEBOOK, accountId: 'fb123' }],
    dateRange: {
      startDate: new Date('2023-01-01'),
      endDate: new Date('2023-01-31'),
    },
  };

  const mockContentPerformanceDto = {
    postIds: [{ platform: SocialPlatform.FACEBOOK, postId: 'fbpost123' }],
  };

  // Mock files
  const mockFiles = [
    {
      fieldname: 'file',
      originalname: 'image.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('test'),
      size: 1024,
    },
  ] as Express.Multer.File[];

  // Mock service responses
  const mockConnectedPlatforms = [
    {
      platform: SocialPlatform.FACEBOOK,
      accountId: 'fb123',
      accountName: 'Facebook Page',
      connected: true,
    },
  ];

  const mockPublishResult = {
    publishId: mockPublishId,
    status: PublishStatus.COMPLETED,
    mediaItems: [
      {
        id: 'media1',
        url: 'https://cdn.example.com/image.jpg',
        mimeType: 'image/jpeg',
      },
    ],
    results: [
      {
        platform: SocialPlatform.FACEBOOK,
        accountId: 'fb123',
        success: true,
        postId: 'fbpost123',
        postedAt: new Date(),
      },
    ],
  };

  const mockScheduledPost = {
    id: mockPostId,
    userId: mockUserId,
    content: 'Test scheduled content',
    platforms: [{ platform: SocialPlatform.FACEBOOK, accountId: 'fb123' }],
    scheduledTime: new Date('2023-12-31T12:00:00Z'),
    status: ScheduleStatus.PENDING,
    mediaItems: [
      {
        id: 'media1',
        url: 'https://cdn.example.com/image.jpg',
        mimeType: 'image/jpeg',
      },
    ],
  };

  const mockAnalyticsResult = [
    {
      platform: SocialPlatform.FACEBOOK,
      accountId: 'fb123',
      metrics: {
        followers: 1000,
        engagement: 500,
        impressions: 5000,
        reach: 3000,
      },
      success: true,
    },
  ];

  const mockContentPerformanceResult = [
    {
      platform: SocialPlatform.FACEBOOK,
      postId: 'fbpost123',
      metrics: {
        likes: 100,
        shares: 50,
        comments: 25,
        reach: 1000,
        impressions: 2000,
      },
      success: true,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CrossPlatformController],
      providers: [
        {
          provide: CrossPlatformService,
          useValue: {
            getConnectedPlatforms: jest.fn(),
            disconnectPlatform: jest.fn(),
          },
        },
        {
          provide: ContentPublisherService,
          useValue: {
            publishContentWithMedia: jest.fn(),
            getPublishStatus: jest.fn(),
          },
        },
        {
          provide: AnalyticsService,
          useValue: {
            getAccountAnalytics: jest.fn(),
            getContentPerformance: jest.fn(),
          },
        },
        {
          provide: SchedulerService,
          useValue: {
            schedulePost: jest.fn(),
            getScheduledPosts: jest.fn(),
            updateScheduledPost: jest.fn(),
            cancelScheduledPost: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CrossPlatformController>(CrossPlatformController);
    crossPlatformService = module.get(
      CrossPlatformService,
    ) as jest.Mocked<CrossPlatformService>;
    contentPublisherService = module.get(
      ContentPublisherService,
    ) as jest.Mocked<ContentPublisherService>;
    analyticsService = module.get(
      AnalyticsService,
    ) as jest.Mocked<AnalyticsService>;
    schedulerService = module.get(
      SchedulerService,
    ) as jest.Mocked<SchedulerService>;

    // Setup default mock responses
    crossPlatformService.getConnectedPlatforms.mockResolvedValue(
      mockConnectedPlatforms,
    );
    crossPlatformService.disconnectPlatform.mockResolvedValue(undefined);
    contentPublisherService.publishContentWithMedia.mockResolvedValue(
      mockPublishResult,
    );
    contentPublisherService.getPublishStatus.mockResolvedValue(
      PublishStatus.COMPLETED,
    );
    schedulerService.schedulePost.mockResolvedValue(mockScheduledPost);
    schedulerService.getScheduledPosts.mockResolvedValue([mockScheduledPost]);
    schedulerService.updateScheduledPost.mockResolvedValue(mockScheduledPost);
    schedulerService.cancelScheduledPost.mockResolvedValue(undefined);
    analyticsService.getAccountAnalytics.mockResolvedValue(mockAnalyticsResult);
    analyticsService.getContentPerformance.mockResolvedValue(
      mockContentPerformanceResult,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getConnectedPlatforms', () => {
    it('should return connected platforms for a user', async () => {
      const result = await controller.getConnectedPlatforms(mockUserId);

      expect(crossPlatformService.getConnectedPlatforms).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(result).toEqual(mockConnectedPlatforms);
    });
  });

  describe('disconnectPlatform', () => {
    it('should disconnect a platform for a user', async () => {
      await controller.disconnectPlatform(
        SocialPlatform.FACEBOOK,
        'fb123',
        mockUserId,
      );

      expect(crossPlatformService.disconnectPlatform).toHaveBeenCalledWith(
        mockUserId,
        SocialPlatform.FACEBOOK,
        'fb123',
      );
    });
  });

  describe('publishContent', () => {
    it('should publish content with uploaded files', async () => {
      const result = await controller.publishContent(
        mockFiles,
        mockCreatePostDto,
        mockUserId,
      );

      expect(
        contentPublisherService.publishContentWithMedia,
      ).toHaveBeenCalledWith({
        userId: mockUserId,
        content: mockCreatePostDto.content,
        files: mockFiles,
        mediaUrls: mockCreatePostDto.mediaUrls,
        platforms: mockCreatePostDto.platforms,
      });

      expect(result).toEqual(mockPublishResult);
    });

    it('should handle empty files array', async () => {
      await controller.publishContent(null, mockCreatePostDto, mockUserId);

      expect(
        contentPublisherService.publishContentWithMedia,
      ).toHaveBeenCalledWith({
        userId: mockUserId,
        content: mockCreatePostDto.content,
        files: [],
        mediaUrls: mockCreatePostDto.mediaUrls,
        platforms: mockCreatePostDto.platforms,
      });
    });
  });

  describe('getPublishStatus', () => {
    it('should return the publish status for a specific ID', async () => {
      const result = await controller.getPublishStatus(
        mockPublishId,
        mockUserId,
      );

      expect(contentPublisherService.getPublishStatus).toHaveBeenCalledWith(
        mockPublishId,
        mockUserId,
      );

      expect(result).toEqual(PublishStatus.COMPLETED);
    });
  });

  describe('schedulePost', () => {
    it('should schedule a post with uploaded files', async () => {
      const result = await controller.schedulePost(
        mockFiles,
        mockSchedulePostDto,
        mockUserId,
      );

      expect(schedulerService.schedulePost).toHaveBeenCalledWith({
        userId: mockUserId,
        content: mockSchedulePostDto.content,
        files: mockFiles,
        mediaUrls: mockSchedulePostDto.mediaUrls,
        platforms: mockSchedulePostDto.platforms,
        scheduledTime: new Date(mockSchedulePostDto.scheduledTime),
      });

      expect(result).toEqual(mockScheduledPost);
    });

    it('should handle empty files array', async () => {
      await controller.schedulePost(null, mockSchedulePostDto, mockUserId);

      expect(schedulerService.schedulePost).toHaveBeenCalledWith({
        userId: mockUserId,
        content: mockSchedulePostDto.content,
        files: [],
        mediaUrls: mockSchedulePostDto.mediaUrls,
        platforms: mockSchedulePostDto.platforms,
        scheduledTime: new Date(mockSchedulePostDto.scheduledTime),
      });
    });
  });

  describe('getScheduledPosts', () => {
    it('should return scheduled posts with transformed date filters', async () => {
      const result = await controller.getScheduledPosts(
        mockScheduleFiltersDto,
        mockUserId,
      );

      expect(schedulerService.getScheduledPosts).toHaveBeenCalledWith(
        mockUserId,
        {
          ...mockScheduleFiltersDto,
          startDate: new Date(mockScheduleFiltersDto.startDate),
          endDate: new Date(mockScheduleFiltersDto.endDate),
        },
      );

      expect(result).toEqual([mockScheduledPost]);
    });

    it('should handle undefined date filters', async () => {
      const filtersWithoutDates = {
        status: ScheduleStatus.PENDING,
        platform: SocialPlatform.FACEBOOK,
      };

      await controller.getScheduledPosts(filtersWithoutDates, mockUserId);

      expect(schedulerService.getScheduledPosts).toHaveBeenCalledWith(
        mockUserId,
        {
          ...filtersWithoutDates,
          startDate: undefined,
          endDate: undefined,
        },
      );
    });
  });

  describe('updateScheduledPost', () => {
    it('should update a scheduled post with transformed date', async () => {
      const result = await controller.updateScheduledPost(
        mockPostId,
        mockUpdateScheduleDto,
        mockUserId,
      );

      expect(schedulerService.updateScheduledPost).toHaveBeenCalledWith(
        mockPostId,
        mockUserId,
        {
          ...mockUpdateScheduleDto,
          scheduledTime: new Date(mockUpdateScheduleDto.scheduledTime),
        },
      );

      expect(result).toEqual(mockScheduledPost);
    });

    it('should handle undefined scheduledTime', async () => {
      const updateWithoutTime = {
        content: 'Updated content',
      };

      await controller.updateScheduledPost(
        mockPostId,
        updateWithoutTime,
        mockUserId,
      );

      expect(schedulerService.updateScheduledPost).toHaveBeenCalledWith(
        mockPostId,
        mockUserId,
        {
          ...updateWithoutTime,
          scheduledTime: undefined,
        },
      );
    });
  });

  describe('cancelScheduledPost', () => {
    it('should cancel a scheduled post', async () => {
      await controller.cancelScheduledPost(mockPostId, mockUserId);

      expect(schedulerService.cancelScheduledPost).toHaveBeenCalledWith(
        mockPostId,
        mockUserId,
      );
    });
  });

  describe('getAnalytics', () => {
    it('should return analytics for specified platforms', async () => {
      const result = await controller.getAnalytics(
        mockAnalyticsDto,
        mockUserId,
      );

      expect(analyticsService.getAccountAnalytics).toHaveBeenCalledWith({
        userId: mockUserId,
        ...mockAnalyticsDto,
      });

      expect(result).toEqual(mockAnalyticsResult);
    });
  });

  describe('getContentPerformance', () => {
    it('should return performance metrics for specified posts', async () => {
      const result = await controller.getContentPerformance(
        mockContentPerformanceDto,
        mockUserId,
      );

      expect(analyticsService.getContentPerformance).toHaveBeenCalledWith({
        userId: mockUserId,
        ...mockContentPerformanceDto,
      });

      expect(result).toEqual(mockContentPerformanceResult);
    });
  });
});
