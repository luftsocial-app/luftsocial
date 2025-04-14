import { Test, TestingModule } from '@nestjs/testing';
import { CrossPlatformController } from './cross-platform.controller';
import { CrossPlatformService } from './cross-platform.service';
import { ContentPublisherService } from './services/content-publisher.service';
import { AnalyticsService } from './services/analytics.service';
import { SchedulerService } from './services/scheduler.service';
import { RetryQueueService } from './services/retry-queue.service';
import { PinoLogger } from 'nestjs-pino';
import { HttpException, HttpStatus } from '@nestjs/common';
import { SocialPlatform } from '../common/enums/social-platform.enum';
import { PublishStatus } from './helpers/cross-platform.interface';
import { CreateCrossPlatformPostDto } from './helpers/dtos/cross-platform.dto';

describe('CrossPlatformController', () => {
  let controller: CrossPlatformController;
  let crossPlatformService: CrossPlatformService;
  let contentPublisherService: ContentPublisherService;
  let analyticsService: AnalyticsService;
  let schedulerService: SchedulerService;
  let retryQueueService: RetryQueueService;
  let logger: PinoLogger;

  // Mock services
  const mockCrossPlatformService = {
    getConnectedPlatforms: jest.fn(),
    disconnectPlatform: jest.fn(),
  };

  const mockContentPublisherService = {
    validateFiles: jest.fn(),
    validateMediaRequirements: jest.fn(),
    publishContentWithMedia: jest.fn(),
    getPublishStatus: jest.fn(),
    findPublishById: jest.fn(),
    findUserPublishRecords: jest.fn(),
    retryPublish: jest.fn(),
    updatePublishStatus: jest.fn(),
  };

  const mockAnalyticsService = {
    getAccountAnalytics: jest.fn(),
    getContentPerformance: jest.fn(),
  };

  const mockSchedulerService = {
    schedulePost: jest.fn(),
    getScheduledPosts: jest.fn(),
    updateScheduledPost: jest.fn(),
    cancelScheduledPost: jest.fn(),
  };

  const mockRetryQueueService = {
    getPendingRetries: jest.fn(),
    cancelRetry: jest.fn(),
  };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CrossPlatformController],
      providers: [
        { provide: CrossPlatformService, useValue: mockCrossPlatformService },
        {
          provide: ContentPublisherService,
          useValue: mockContentPublisherService,
        },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
        { provide: SchedulerService, useValue: mockSchedulerService },
        { provide: RetryQueueService, useValue: mockRetryQueueService },
        { provide: PinoLogger, useValue: mockLogger },
      ],
    }).compile();

    controller = module.get<CrossPlatformController>(CrossPlatformController);
    crossPlatformService =
      module.get<CrossPlatformService>(CrossPlatformService);
    contentPublisherService = module.get<ContentPublisherService>(
      ContentPublisherService,
    );
    analyticsService = module.get<AnalyticsService>(AnalyticsService);
    schedulerService = module.get<SchedulerService>(SchedulerService);
    retryQueueService = module.get<RetryQueueService>(RetryQueueService);
    logger = module.get<PinoLogger>(PinoLogger);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getConnectedPlatforms', () => {
    it('should return connected platforms for a user', async () => {
      // Arrange
      const mockUser = { userId: 'user-123' };
      const mockConnectedPlatforms = [
        { platform: SocialPlatform.FACEBOOK, accountId: 'fb-123' },
        { platform: SocialPlatform.INSTAGRAM, accountId: 'ig-123' },
      ];
      mockCrossPlatformService.getConnectedPlatforms.mockResolvedValue(
        mockConnectedPlatforms,
      );

      // Act
      const result = await controller.getConnectedPlatforms(mockUser);

      // Assert
      expect(
        mockCrossPlatformService.getConnectedPlatforms,
      ).toHaveBeenCalledWith(mockUser.userId);
      expect(result).toEqual(mockConnectedPlatforms);
    });
  });

  describe('disconnectPlatform', () => {
    it('should disconnect a platform for a user', async () => {
      // Arrange
      const platform = SocialPlatform.FACEBOOK;
      const accountId = 'fb-123';
      const userId = 'user-123';
      mockCrossPlatformService.disconnectPlatform.mockResolvedValue({
        success: true,
      });

      // Act
      const result = await controller.disconnectPlatform(
        platform,
        accountId,
        userId,
      );

      // Assert
      expect(mockCrossPlatformService.disconnectPlatform).toHaveBeenCalledWith(
        userId,
        platform,
        accountId,
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('publishContent', () => {
    const mockUser = { userId: 'user-123' };
    const mockFiles = [
      {
        fieldname: 'files',
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('test image'),
        size: 1024,
      },
    ] as Express.Multer.File[];

    const mockCreatePostDto: CreateCrossPlatformPostDto = {
      content: 'Test post content',
      platforms: [{ platform: SocialPlatform.FACEBOOK, accountId: 'fb-123' }],
      mediaUrls: ['https://example.com/image.jpg'],
    };

    const mockPublishResult = {
      publishId: 'pub-123',
      status: PublishStatus.COMPLETED,
      mediaItems: [{ url: 'https://cdn.example.com/img.jpg' }],
      results: [{ platform: SocialPlatform.FACEBOOK, success: true }],
    };

    it('should successfully publish content across platforms', async () => {
      // Arrange
      mockCrossPlatformService.getConnectedPlatforms.mockResolvedValue([
        { platform: SocialPlatform.FACEBOOK, accountId: 'fb-123' },
      ]);
      mockContentPublisherService.publishContentWithMedia.mockResolvedValue(
        mockPublishResult,
      );

      // Act
      const result = await controller.publishContent(
        mockFiles,
        mockCreatePostDto,
        mockUser,
      );

      // Assert
      expect(
        mockCrossPlatformService.getConnectedPlatforms,
      ).toHaveBeenCalledWith(mockUser.userId);
      expect(mockContentPublisherService.validateFiles).toHaveBeenCalledWith(
        mockFiles,
      );
      expect(
        mockContentPublisherService.validateMediaRequirements,
      ).toHaveBeenCalledWith(mockCreatePostDto, mockFiles);
      expect(
        mockContentPublisherService.publishContentWithMedia,
      ).toHaveBeenCalledWith({
        userId: mockUser.userId,
        content: mockCreatePostDto.content,
        files: mockFiles,
        mediaUrls: mockCreatePostDto.mediaUrls,
        platforms: mockCreatePostDto.platforms,
      });
      expect(result).toEqual(mockPublishResult);
    });

    it('should throw an exception when no connected platforms found', async () => {
      // Arrange
      mockCrossPlatformService.getConnectedPlatforms.mockResolvedValue([]);

      // Act & Assert
      await expect(
        controller.publishContent(mockFiles, mockCreatePostDto, mockUser),
      ).rejects.toThrow(
        new HttpException(
          'No connected platforms found. Please connect at least one platform.',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw an exception when no platforms selected', async () => {
      // Arrange
      mockCrossPlatformService.getConnectedPlatforms.mockResolvedValue([
        { platform: SocialPlatform.FACEBOOK, accountId: 'fb-123' },
      ]);
      const dtoWithoutPlatforms = { ...mockCreatePostDto, platforms: [] };

      // Act & Assert
      await expect(
        controller.publishContent(mockFiles, dtoWithoutPlatforms, mockUser),
      ).rejects.toThrow(
        new HttpException(
          'No platforms selected for publishing. Please select at least one platform.',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw an exception when selected platforms are not connected', async () => {
      // Arrange
      mockCrossPlatformService.getConnectedPlatforms.mockResolvedValue([
        { platform: SocialPlatform.INSTAGRAM, accountId: 'ig-123' },
      ]);

      // Facebook is selected but not connected
      const dtoWithInvalidPlatform = {
        ...mockCreatePostDto,
        platforms: [{ platform: SocialPlatform.FACEBOOK, accountId: 'fb-123' }],
      };

      // Act & Assert
      await expect(
        controller.publishContent(mockFiles, dtoWithInvalidPlatform, mockUser),
      ).rejects.toThrow(HttpException);
    });

    it('should throw an exception when media is required but not provided', async () => {
      // Arrange
      mockCrossPlatformService.getConnectedPlatforms.mockResolvedValue([
        { platform: SocialPlatform.INSTAGRAM, accountId: 'ig-123' },
      ]);

      const dtoWithInstagramNoMedia = {
        content: 'Test post content',
        platforms: [
          { platform: SocialPlatform.INSTAGRAM, accountId: 'ig-123' },
        ],
        mediaUrls: [], // No media URLs
      };
      const emptyFiles = [] as Express.Multer.File[];

      // Act & Assert
      await expect(
        controller.publishContent(
          emptyFiles,
          dtoWithInstagramNoMedia,
          mockUser,
        ),
      ).rejects.toThrow(
        new HttpException(
          'Media files are required for Instagram and TikTok posts',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should handle errors from contentPublisherService', async () => {
      // Arrange
      mockCrossPlatformService.getConnectedPlatforms.mockResolvedValue([
        { platform: SocialPlatform.FACEBOOK, accountId: 'fb-123' },
      ]);
      mockContentPublisherService.validateMediaRequirements.mockRejectedValue(
        new Error('Media validation failed'),
      );

      // Act & Assert
      await expect(
        controller.publishContent(mockFiles, mockCreatePostDto, mockUser),
      ).rejects.toThrow(HttpException);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getPublishStatus', () => {
    it('should return the status of a publish operation', async () => {
      // Arrange
      const publishId = 'pub-123';
      const userId = 'user-123';
      const mockStatus = PublishStatus.COMPLETED;
      const mockPendingRetries = [];
      const mockRecord = {
        id: publishId,
        status: mockStatus,
        results: [{ platform: SocialPlatform.FACEBOOK, success: true }],
        platforms: [{ platform: SocialPlatform.FACEBOOK }],
        content: 'Test content',
        mediaItems: [{ url: 'https://example.com/image.jpg' }],
        createdAt: new Date(),
      };

      mockContentPublisherService.getPublishStatus.mockResolvedValue(
        mockStatus,
      );
      mockRetryQueueService.getPendingRetries.mockResolvedValue(
        mockPendingRetries,
      );
      mockContentPublisherService.findPublishById.mockResolvedValue(mockRecord);

      // Act
      const result = await controller.getPublishStatus(publishId, userId);

      // Assert
      expect(mockContentPublisherService.getPublishStatus).toHaveBeenCalledWith(
        publishId,
        userId,
      );
      expect(mockRetryQueueService.getPendingRetries).toHaveBeenCalledWith(
        publishId,
      );
      expect(mockContentPublisherService.findPublishById).toHaveBeenCalledWith(
        publishId,
        userId,
      );

      expect(result).toEqual({
        id: publishId,
        status: mockStatus,
        results: mockRecord.results,
        platforms: mockRecord.platforms,
        content: mockRecord.content,
        mediaItems: mockRecord.mediaItems,
        createdAt: mockRecord.createdAt,
        pendingRetries: mockPendingRetries,
      });
    });

    it('should handle errors when getting publish status', async () => {
      // Arrange
      const publishId = 'pub-123';
      const userId = 'user-123';
      mockContentPublisherService.getPublishStatus.mockRejectedValue(
        new Error('Publish record not found'),
      );

      // Act & Assert
      await expect(
        controller.getPublishStatus(publishId, userId),
      ).rejects.toThrow(HttpException);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getUserPublishes', () => {
    it('should return paginated publish records for a user', async () => {
      // Arrange
      const userId = 'user-123';
      const page = 1;
      const limit = 10;
      const status = PublishStatus.COMPLETED;

      const mockPublishes = {
        items: [
          { id: 'pub-1', status: PublishStatus.COMPLETED },
          { id: 'pub-2', status: PublishStatus.COMPLETED },
        ],
        total: 2,
        page: 1,
        limit: 10,
      };

      mockContentPublisherService.findUserPublishRecords.mockResolvedValue(
        mockPublishes,
      );

      // Act
      const result = await controller.getUserPublishes(
        userId,
        page,
        limit,
        status,
      );

      // Assert
      expect(
        mockContentPublisherService.findUserPublishRecords,
      ).toHaveBeenCalledWith(userId, page, limit, status);
      expect(result).toEqual(mockPublishes);
    });

    it('should handle errors when getting user publishes', async () => {
      // Arrange
      const userId = 'user-123';
      mockContentPublisherService.findUserPublishRecords.mockRejectedValue(
        new Error('Database error'),
      );

      // Act & Assert
      await expect(controller.getUserPublishes(userId)).rejects.toThrow(
        HttpException,
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('retryPlatformPublish', () => {
    it('should successfully retry a failed platform publish', async () => {
      // Arrange
      const publishId = 'pub-123';
      const platform = 'facebook';
      const accountId = 'fb-123';
      const userId = 'user-123';

      mockContentPublisherService.getPublishStatus.mockResolvedValue(
        PublishStatus.PARTIALLY_COMPLETED,
      );
      mockContentPublisherService.retryPublish.mockResolvedValue(true);

      // Act
      const result = await controller.retryPlatformPublish(
        publishId,
        platform,
        accountId,
        userId,
      );

      // Assert
      expect(mockContentPublisherService.getPublishStatus).toHaveBeenCalledWith(
        publishId,
        userId,
      );
      expect(mockContentPublisherService.retryPublish).toHaveBeenCalledWith(
        publishId,
        platform,
        accountId,
      );
      expect(result).toEqual({
        success: true,
        message: 'Retry initiated successfully',
      });
    });

    it('should throw exception when retry fails', async () => {
      // Arrange
      const publishId = 'pub-123';
      const platform = 'facebook';
      const accountId = 'fb-123';
      const userId = 'user-123';

      mockContentPublisherService.getPublishStatus.mockResolvedValue(
        PublishStatus.PARTIALLY_COMPLETED,
      );
      mockContentPublisherService.retryPublish.mockResolvedValue(false);

      // Act & Assert
      await expect(
        controller.retryPlatformPublish(publishId, platform, accountId, userId),
      ).rejects.toThrow(
        new HttpException(
          'Failed to retry platform publish: Failed to initiate retry',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });

    it('should handle errors when retrying platform publish', async () => {
      // Arrange
      const publishId = 'pub-123';
      const platform = 'facebook';
      const accountId = 'fb-123';
      const userId = 'user-123';

      mockContentPublisherService.getPublishStatus.mockRejectedValue(
        new Error('Publish record not found'),
      );

      // Act & Assert
      await expect(
        controller.retryPlatformPublish(publishId, platform, accountId, userId),
      ).rejects.toThrow(HttpException);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('cancelRetry', () => {
    it('should successfully cancel a retry', async () => {
      // Arrange
      const retryId = 'retry-123';
      mockRetryQueueService.cancelRetry.mockResolvedValue(true);

      // Act
      const result = await controller.cancelRetry(retryId);

      // Assert
      expect(mockRetryQueueService.cancelRetry).toHaveBeenCalledWith(retryId);
      expect(result).toEqual({
        success: true,
        message: 'Retry cancelled successfully',
      });
    });

    it('should throw exception when cancel fails', async () => {
      // Arrange
      const retryId = 'retry-123';
      mockRetryQueueService.cancelRetry.mockResolvedValue(false);

      // Act & Assert
      await expect(controller.cancelRetry(retryId)).rejects.toThrow(
        new HttpException(
          'Failed to cancel retry: Failed to cancel retry',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });

    it('should handle errors when cancelling retry', async () => {
      // Arrange
      const retryId = 'retry-123';
      mockRetryQueueService.cancelRetry.mockRejectedValue(
        new Error('Retry not found'),
      );

      // Act & Assert
      await expect(controller.cancelRetry(retryId)).rejects.toThrow(
        HttpException,
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('cancelScheduledPublish', () => {
    it('should successfully cancel a scheduled publish', async () => {
      // Arrange
      const publishId = 'pub-123';
      const userId = 'user-123';

      mockContentPublisherService.getPublishStatus.mockResolvedValue(
        PublishStatus.PENDING,
      );
      mockContentPublisherService.updatePublishStatus.mockResolvedValue(true);

      // Act
      const result = await controller.cancelScheduledPublish(publishId, userId);

      // Assert
      expect(mockContentPublisherService.getPublishStatus).toHaveBeenCalledWith(
        publishId,
        userId,
      );
      expect(
        mockContentPublisherService.updatePublishStatus,
      ).toHaveBeenCalledWith(publishId, PublishStatus.CANCELED);
      expect(result).toEqual({
        success: true,
        message: 'Scheduled publish cancelled successfully',
      });
    });

    it('should throw exception when cancel fails', async () => {
      // Arrange
      const publishId = 'pub-123';
      const userId = 'user-123';

      mockContentPublisherService.getPublishStatus.mockResolvedValue(
        PublishStatus.PENDING,
      );
      mockContentPublisherService.updatePublishStatus.mockResolvedValue(false);

      // Act & Assert
      await expect(
        controller.cancelScheduledPublish(publishId, userId),
      ).rejects.toThrow(
        new HttpException(
          'Failed to cancel scheduled publish: Failed to cancel scheduled publish',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });

    it('should handle errors when cancelling scheduled publish', async () => {
      // Arrange
      const publishId = 'pub-123';
      const userId = 'user-123';

      mockContentPublisherService.getPublishStatus.mockRejectedValue(
        new Error('Publish record not found'),
      );

      // Act & Assert
      await expect(
        controller.cancelScheduledPublish(publishId, userId),
      ).rejects.toThrow(HttpException);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('schedulePost', () => {
    it('should schedule a post successfully', async () => {
      // Arrange
      const files = [
        {
          fieldname: 'files',
          originalname: 'test.jpg',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('test image'),
          size: 1024,
        },
      ] as Express.Multer.File[];

      const schedulePostDto = {
        content: 'Scheduled post content',
        platforms: [{ platform: SocialPlatform.FACEBOOK, accountId: 'fb-123' }],
        mediaUrls: ['https://example.com/image.jpg'],
        scheduledTime: '2023-12-01T12:00:00Z',
      };

      const userId = 'user-123';

      const mockResult = {
        id: 'schedule-123',
        status: 'SCHEDULED',
        scheduledTime: new Date('2023-12-01T12:00:00Z'),
      };

      mockSchedulerService.schedulePost.mockResolvedValue(mockResult);

      // Act
      const result = await controller.schedulePost(
        files,
        schedulePostDto,
        userId,
      );

      // Assert
      expect(mockSchedulerService.schedulePost).toHaveBeenCalledWith({
        userId,
        content: schedulePostDto.content,
        files: files,
        mediaUrls: schedulePostDto.mediaUrls,
        platforms: schedulePostDto.platforms,
        scheduledTime: new Date(schedulePostDto.scheduledTime),
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getScheduledPosts', () => {
    it('should return scheduled posts with transformed filters', async () => {
      // Arrange
      const filters = {
        startDate: '2023-12-01',
        endDate: '2023-12-31',
        platform: SocialPlatform.FACEBOOK,
      };

      const userId = 'user-123';

      const mockScheduledPosts = [
        {
          id: 'schedule-1',
          content: 'Post 1',
          scheduledTime: new Date('2023-12-15T12:00:00Z'),
        },
        {
          id: 'schedule-2',
          content: 'Post 2',
          scheduledTime: new Date('2023-12-20T15:30:00Z'),
        },
      ];

      mockSchedulerService.getScheduledPosts.mockResolvedValue(
        mockScheduledPosts,
      );

      // Act
      const result = await controller.getScheduledPosts(filters, userId);

      // Assert
      expect(mockSchedulerService.getScheduledPosts).toHaveBeenCalledWith(
        userId,
        {
          ...filters,
          startDate: new Date(filters.startDate),
          endDate: new Date(filters.endDate),
        },
      );
      expect(result).toEqual(mockScheduledPosts);
    });
  });

  describe('updateScheduledPost', () => {
    it('should update a scheduled post successfully', async () => {
      // Arrange
      const postId = 'schedule-123';
      const updateScheduleDto = {
        content: 'Updated content',
        scheduledTime: '2023-12-15T14:00:00Z',
      };
      const userId = 'user-123';

      const mockResult = {
        id: postId,
        content: updateScheduleDto.content,
        scheduledTime: new Date(updateScheduleDto.scheduledTime),
      };

      mockSchedulerService.updateScheduledPost.mockResolvedValue(mockResult);

      // Act
      const result = await controller.updateScheduledPost(
        postId,
        updateScheduleDto,
        userId,
      );

      // Assert
      expect(mockSchedulerService.updateScheduledPost).toHaveBeenCalledWith(
        postId,
        userId,
        {
          ...updateScheduleDto,
          scheduledTime: new Date(updateScheduleDto.scheduledTime),
        },
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('cancelScheduledPost', () => {
    it('should cancel a scheduled post successfully', async () => {
      // Arrange
      const postId = 'schedule-123';
      const userId = 'user-123';

      const mockResult = { success: true };

      mockSchedulerService.cancelScheduledPost.mockResolvedValue(mockResult);

      // Act
      const result = await controller.cancelScheduledPost(postId, userId);

      // Assert
      expect(mockSchedulerService.cancelScheduledPost).toHaveBeenCalledWith(
        postId,
        userId,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getAnalytics', () => {
    it('should return analytics data', async () => {
      // Arrange
      const analyticsDto = {
        platform: SocialPlatform.FACEBOOK,
        accountId: 'fb-123',
        startDate: '2023-12-01',
        endDate: '2023-12-31',
      };

      const userId = 'user-123';

      const mockAnalytics = {
        followers: 1000,
        engagement: 5.2,
        impressions: 15000,
      };

      mockAnalyticsService.getAccountAnalytics.mockResolvedValue(mockAnalytics);

      // Act
      const result = await controller.getAnalytics(analyticsDto, userId);

      // Assert
      expect(mockAnalyticsService.getAccountAnalytics).toHaveBeenCalledWith({
        userId,
        ...analyticsDto,
      });
      expect(result).toEqual(mockAnalytics);
    });
  });

  describe('getContentPerformance', () => {
    it('should return content performance data', async () => {
      // Arrange
      const contentPerformanceDto = {
        platform: SocialPlatform.FACEBOOK,
        accountId: 'fb-123',
        postId: 'post-123',
      };

      const userId = 'user-123';

      const mockPerformance = {
        likes: 120,
        comments: 45,
        shares: 30,
        reach: 5000,
      };

      mockAnalyticsService.getContentPerformance.mockResolvedValue(
        mockPerformance,
      );

      // Act
      const result = await controller.getContentPerformance(
        contentPerformanceDto,
        userId,
      );

      // Assert
      expect(mockAnalyticsService.getContentPerformance).toHaveBeenCalledWith({
        userId,
        ...contentPerformanceDto,
      });
      expect(result).toEqual(mockPerformance);
    });
  });
});
