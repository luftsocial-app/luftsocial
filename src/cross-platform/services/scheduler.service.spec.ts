import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { ContentPublisherService } from './content-publisher.service';
import { MediaStorageService } from '../../asset-management/media-storage/media-storage.service';
import { ScheduledPost } from '../../entities/cross-platform-entities/schedule.entity';
import { SocialPlatform } from '../../common/enums/social-platform.enum';
import {
  PublishStatus,
  ScheduleStatus,
} from '../helpers/cross-platform.interface';

describe('SchedulerService', () => {
  let service: SchedulerService;
  let scheduledPostRepo: jest.Mocked<Repository<ScheduledPost>>;
  let contentPublisherService: jest.Mocked<ContentPublisherService>;
  let mediaStorageService: jest.Mocked<MediaStorageService>;
  let loggerSpy: jest.SpyInstance;

  const mockUserId = 'user123';
  const mockPostId = 'post123';
  const mockContent = 'Test scheduled content';
  const mockFutureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day in the future
  const mockPastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day in the past

  // Mock file and media URLs
  const mockFile = {
    fieldname: 'file',
    originalname: 'image.jpg',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('test'),
    size: 1024,
  } as Express.Multer.File;

  const mockMediaUrl = 'https://example.com/image.jpg';

  // Mock uploaded media items
  const mockUploadedFile = {
    id: 'uploadedFile1',
    url: 'https://cdn.example.com/image1.jpg',
    mimeType: 'image/jpeg',
    fileName: 'image1.jpg',
    size: 1024,
  };

  const mockUploadedUrl = {
    id: 'uploadedUrl1',
    url: 'https://cdn.example.com/image2.jpg',
    mimeType: 'image/jpeg',
    fileName: 'image2.jpg',
    size: 2048,
  };

  // Mock scheduled post
  const mockScheduledPost = {
    id: mockPostId,
    userId: mockUserId,
    content: mockContent,
    platforms: [{ platform: SocialPlatform.FACEBOOK, accountId: 'fb123' }],
    scheduledTime: mockFutureDate,
    status: ScheduleStatus.PENDING,
    mediaItems: [mockUploadedFile],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock publish result
  const mockPublishResult = {
    publishId: 'publish123',
    status: PublishStatus.COMPLETED,
    mediaItems: [mockUploadedFile],
    results: [
      {
        platform: SocialPlatform.FACEBOOK,
        accountId: 'fb123',
        success: true,
        postId: 'fb_post_123',
        postedAt: new Date(),
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        {
          provide: getRepositoryToken(ScheduledPost),
          useValue: {
            save: jest.fn(),
            update: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getMany: jest.fn(),
            })),
          },
        },
        {
          provide: ContentPublisherService,
          useValue: {
            publishContentWithMedia: jest.fn(),
          },
        },
        {
          provide: MediaStorageService,
          useValue: {
            uploadPostMedia: jest.fn(),
            uploadMediaFromUrl: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
    scheduledPostRepo = module.get(
      getRepositoryToken(ScheduledPost),
    ) as jest.Mocked<Repository<ScheduledPost>>;
    contentPublisherService = module.get(
      ContentPublisherService,
    ) as jest.Mocked<ContentPublisherService>;
    mediaStorageService = module.get(
      MediaStorageService,
    ) as jest.Mocked<MediaStorageService>;

    // Mock Logger
    loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processScheduledPosts', () => {
    it('should process pending posts that are due', async () => {
      // Mock finding pending posts
      const mockPendingPosts = [
        {
          id: 'post1',
          userId: mockUserId,
          content: 'Post 1 content',
          platforms: [
            { platform: SocialPlatform.FACEBOOK, accountId: 'fb123' },
          ],
          mediaItems: [mockUploadedFile],
          status: ScheduleStatus.PENDING,
          scheduledTime: mockPastDate,
        },
        {
          id: 'post2',
          userId: mockUserId,
          content: 'Post 2 content',
          platforms: [
            { platform: SocialPlatform.INSTAGRAM, accountId: 'ig123' },
          ],
          mediaUrls: [mockMediaUrl],
          status: ScheduleStatus.PENDING,
          scheduledTime: mockPastDate,
        },
      ];

      scheduledPostRepo.find.mockResolvedValue(mockPendingPosts);
      contentPublisherService.publishContentWithMedia.mockResolvedValue(
        mockPublishResult,
      );

      await service.processScheduledPosts();

      // Verify posts were marked as processing
      expect(scheduledPostRepo.update).toHaveBeenCalledWith('post1', {
        status: ScheduleStatus.PROCESSING,
      });
      expect(scheduledPostRepo.update).toHaveBeenCalledWith('post2', {
        status: ScheduleStatus.PROCESSING,
      });

      // Verify publish was called for each post
      expect(
        contentPublisherService.publishContentWithMedia,
      ).toHaveBeenCalledTimes(2);

      // Verify post statuses were updated after publishing
      expect(scheduledPostRepo.update).toHaveBeenCalledWith('post1', {
        status: ScheduleStatus.PUBLISHED,
        results: mockPublishResult.results,
        publishedAt: expect.any(Date),
      });
      expect(scheduledPostRepo.update).toHaveBeenCalledWith('post2', {
        status: ScheduleStatus.PUBLISHED,
        results: mockPublishResult.results,
        publishedAt: expect.any(Date),
      });
    });

    it('should handle failed publishing and update post status', async () => {
      // Mock finding pending posts
      const mockPendingPost = {
        id: 'post1',
        userId: mockUserId,
        content: 'Post 1 content',
        platforms: [{ platform: SocialPlatform.FACEBOOK, accountId: 'fb123' }],
        mediaItems: [mockUploadedFile],
        status: ScheduleStatus.PENDING,
        scheduledTime: mockPastDate,
      };

      scheduledPostRepo.find.mockResolvedValue([mockPendingPost]);

      // Mock publish failure
      const errorMessage = 'Publishing failed';
      contentPublisherService.publishContentWithMedia.mockRejectedValue(
        new Error(errorMessage),
      );

      await service.processScheduledPosts();

      // Verify post was marked as processing
      expect(scheduledPostRepo.update).toHaveBeenCalledWith('post1', {
        status: ScheduleStatus.PROCESSING,
      });

      // Verify error status was updated
      expect(scheduledPostRepo.update).toHaveBeenCalledWith('post1', {
        status: ScheduleStatus.FAILED,
        error: errorMessage,
      });
    });

    it('should handle partially successful publishing', async () => {
      // Mock finding pending posts
      const mockPendingPost = {
        id: 'post1',
        userId: mockUserId,
        content: 'Post 1 content',
        platforms: [
          { platform: SocialPlatform.FACEBOOK, accountId: 'fb123' },
          { platform: SocialPlatform.INSTAGRAM, accountId: 'ig123' },
        ],
        mediaItems: [mockUploadedFile],
        status: ScheduleStatus.PENDING,
        scheduledTime: mockPastDate,
      };

      scheduledPostRepo.find.mockResolvedValue([mockPendingPost]);

      // Mock partially successful publish
      const partialSuccess = {
        ...mockPublishResult,
        status: PublishStatus.PARTIALLY_COMPLETED,
        results: [
          {
            platform: SocialPlatform.FACEBOOK,
            accountId: 'fb123',
            success: true,
            postId: 'fb_post_123',
            postedAt: new Date(),
          },
          {
            platform: SocialPlatform.INSTAGRAM,
            accountId: 'ig123',
            success: false,
            error: 'Instagram API error',
          },
        ],
      };

      contentPublisherService.publishContentWithMedia.mockResolvedValue(
        partialSuccess,
      );

      await service.processScheduledPosts();

      // Verify post status was updated to partially published
      expect(scheduledPostRepo.update).toHaveBeenCalledWith('post1', {
        status: ScheduleStatus.PARTIALLY_PUBLISHED,
        results: partialSuccess.results,
        publishedAt: expect.any(Date),
      });
    });

    it('should handle exceptions during processing and log errors', async () => {
      const errorMessage = 'Database connection error';
      scheduledPostRepo.find.mockRejectedValue(new Error(errorMessage));

      await service.processScheduledPosts();

      // Verify error was logged
      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to process scheduled posts',
        expect.any(String),
      );
    });
  });

  describe('schedulePost', () => {
    beforeEach(() => {
      // Set up successful repository responses
      scheduledPostRepo.save.mockResolvedValue({
        id: mockPostId,
        userId: mockUserId,
        content: mockContent,
        platforms: [{ platform: SocialPlatform.FACEBOOK, accountId: 'fb123' }],
        scheduledTime: mockFutureDate,
        status: ScheduleStatus.PENDING,
      });

      scheduledPostRepo.findOne.mockResolvedValue(mockScheduledPost);

      // Mock successful media uploads
      mediaStorageService.uploadPostMedia.mockResolvedValue([mockUploadedFile]);
      mediaStorageService.uploadMediaFromUrl.mockResolvedValue(mockUploadedUrl);
    });

    it('should successfully schedule a post with file upload', async () => {
      const result = await service.schedulePost({
        userId: mockUserId,
        content: mockContent,
        platforms: [{ platform: SocialPlatform.FACEBOOK, accountId: 'fb123' }],
        files: [mockFile],
        scheduledTime: mockFutureDate,
      });

      // Verify repository interactions
      expect(scheduledPostRepo.save).toHaveBeenCalledWith({
        userId: mockUserId,
        content: mockContent,
        platforms: [{ platform: SocialPlatform.FACEBOOK, accountId: 'fb123' }],
        scheduledTime: mockFutureDate,
        status: ScheduleStatus.PENDING,
      });

      // Verify media upload
      expect(mediaStorageService.uploadPostMedia).toHaveBeenCalledWith(
        mockUserId,
        [mockFile],
        mockPostId,
      );

      // Verify result is correct
      expect(result).toEqual(mockScheduledPost);
    });

    it('should successfully schedule a post with media URL', async () => {
      const result = await service.schedulePost({
        userId: mockUserId,
        content: mockContent,
        platforms: [{ platform: SocialPlatform.FACEBOOK, accountId: 'fb123' }],
        mediaUrls: [mockMediaUrl],
        scheduledTime: mockFutureDate,
      });

      // Verify media upload
      expect(mediaStorageService.uploadMediaFromUrl).toHaveBeenCalledWith(
        mockUserId,
        mockMediaUrl,
        mockPostId,
      );

      // Verify result is correct
      expect(result).toEqual(mockScheduledPost);
    });

    it('should throw BadRequestException when scheduled time is in the past', async () => {
      await expect(
        service.schedulePost({
          userId: mockUserId,
          content: mockContent,
          platforms: [
            { platform: SocialPlatform.FACEBOOK, accountId: 'fb123' },
          ],
          scheduledTime: mockPastDate,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(scheduledPostRepo.save).not.toHaveBeenCalled();
    });

    it('should handle multiple media uploads from both files and URLs', async () => {
      mediaStorageService.uploadPostMedia.mockResolvedValue([
        mockUploadedFile,
        mockUploadedFile,
      ]);

      await service.schedulePost({
        userId: mockUserId,
        content: mockContent,
        platforms: [{ platform: SocialPlatform.FACEBOOK, accountId: 'fb123' }],
        files: [mockFile, mockFile],
        mediaUrls: [mockMediaUrl, mockMediaUrl],
        scheduledTime: mockFutureDate,
      });

      // Verify media uploads
      expect(mediaStorageService.uploadPostMedia).toHaveBeenCalledWith(
        mockUserId,
        [mockFile, mockFile],
        mockPostId,
      );

      expect(mediaStorageService.uploadMediaFromUrl).toHaveBeenCalledTimes(2);

      // Verify update with all media items
      expect(scheduledPostRepo.update).toHaveBeenCalledWith(mockPostId, {
        mediaItems: expect.arrayContaining([
          mockUploadedFile,
          mockUploadedFile,
          mockUploadedUrl,
          mockUploadedUrl,
        ]),
      });
    });
  });

  describe('getScheduledPosts', () => {
    beforeEach(() => {
      // Mock query builder response
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockScheduledPost]),
      };

      // Make createQueryBuilder return this mock
      scheduledPostRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValue(mockQueryBuilder);
    });

    it('should return scheduled posts for a user without filters', async () => {
      const result = await service.getScheduledPosts(mockUserId);

      // Verify query builder was called correctly
      expect(scheduledPostRepo.createQueryBuilder).toHaveBeenCalledWith('post');

      // Now you can test the query builder methods
      const queryBuilder = scheduledPostRepo.createQueryBuilder();
      expect(queryBuilder.where).toHaveBeenCalledWith('post.userId = :userId', {
        userId: mockUserId,
      });
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'post.scheduledTime',
        'ASC',
      );

      expect(result).toEqual([mockScheduledPost]);
    });

    it('should apply status filter when provided', async () => {
      await service.getScheduledPosts(mockUserId, {
        status: ScheduleStatus.PENDING,
      });

      const queryBuilder = scheduledPostRepo.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'post.status = :status',
        { status: ScheduleStatus.PENDING },
      );
    });

    it('should apply date range filters when provided', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');

      await service.getScheduledPosts(mockUserId, { startDate, endDate });

      const queryBuilder = scheduledPostRepo.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'post.scheduledTime >= :startDate',
        { startDate },
      );

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'post.scheduledTime <= :endDate',
        { endDate },
      );
    });

    it('should apply platform filter when provided', async () => {
      await service.getScheduledPosts(mockUserId, {
        platform: SocialPlatform.FACEBOOK,
      });

      const queryBuilder = scheduledPostRepo.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'post.platforms @> :platform',
        { platform: JSON.stringify([{ platform: SocialPlatform.FACEBOOK }]) },
      );
    });

    it('should apply all filters when provided', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');

      await service.getScheduledPosts(mockUserId, {
        status: ScheduleStatus.PENDING,
        startDate,
        endDate,
        platform: SocialPlatform.FACEBOOK,
      });

      expect(
        scheduledPostRepo.createQueryBuilder().andWhere,
      ).toHaveBeenCalledTimes(4);
    });
  });

  describe('updateScheduledPost', () => {
    beforeEach(() => {
      // Mock finding a pending post
      scheduledPostRepo.findOne.mockResolvedValue(mockScheduledPost);
    });

    it('should update content of a pending post', async () => {
      const updatedContent = 'Updated content';

      await service.updateScheduledPost(mockPostId, mockUserId, {
        content: updatedContent,
      });

      expect(scheduledPostRepo.update).toHaveBeenCalledWith(mockPostId, {
        content: updatedContent,
      });
    });

    it('should update scheduled time of a pending post', async () => {
      const newScheduledTime = new Date(
        mockFutureDate.getTime() + 24 * 60 * 60 * 1000,
      ); // 2 days in future

      await service.updateScheduledPost(mockPostId, mockUserId, {
        scheduledTime: newScheduledTime,
      });

      expect(scheduledPostRepo.update).toHaveBeenCalledWith(mockPostId, {
        scheduledTime: newScheduledTime,
      });
    });

    it('should update platforms of a pending post', async () => {
      const newPlatforms = [
        { platform: SocialPlatform.FACEBOOK, accountId: 'fb123' },
        { platform: SocialPlatform.INSTAGRAM, accountId: 'ig123' },
      ];

      await service.updateScheduledPost(mockPostId, mockUserId, {
        platforms: newPlatforms,
      });

      expect(scheduledPostRepo.update).toHaveBeenCalledWith(mockPostId, {
        platforms: newPlatforms,
      });
    });

    it('should throw NotFoundException when post is not found', async () => {
      scheduledPostRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateScheduledPost(mockPostId, mockUserId, {
          content: 'Updated content',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(scheduledPostRepo.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when post is not in pending status', async () => {
      scheduledPostRepo.findOne.mockResolvedValue({
        ...mockScheduledPost,
        status: ScheduleStatus.PUBLISHED,
      });

      await expect(
        service.updateScheduledPost(mockPostId, mockUserId, {
          content: 'Updated content',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(scheduledPostRepo.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when scheduled time is in the past', async () => {
      await expect(
        service.updateScheduledPost(mockPostId, mockUserId, {
          scheduledTime: mockPastDate,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(scheduledPostRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('cancelScheduledPost', () => {
    beforeEach(() => {
      // Mock finding a pending post
      scheduledPostRepo.findOne.mockResolvedValue(mockScheduledPost);
    });

    it('should cancel a pending post', async () => {
      await service.cancelScheduledPost(mockPostId, mockUserId);

      expect(scheduledPostRepo.update).toHaveBeenCalledWith(mockPostId, {
        status: ScheduleStatus.CANCELLED,
      });
    });

    it('should throw NotFoundException when post is not found', async () => {
      scheduledPostRepo.findOne.mockResolvedValue(null);

      await expect(
        service.cancelScheduledPost(mockPostId, mockUserId),
      ).rejects.toThrow(NotFoundException);

      expect(scheduledPostRepo.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when post is not in pending status', async () => {
      scheduledPostRepo.findOne.mockResolvedValue({
        ...mockScheduledPost,
        status: ScheduleStatus.PUBLISHED,
      });

      await expect(
        service.cancelScheduledPost(mockPostId, mockUserId),
      ).rejects.toThrow(BadRequestException);

      expect(scheduledPostRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('mapPublishStatusToScheduleStatus (private method indirectly tested)', () => {
    it('should map PublishStatus.COMPLETED to ScheduleStatus.PUBLISHED', async () => {
      // Mock finding a pending post
      scheduledPostRepo.find.mockResolvedValue([mockScheduledPost]);

      // Mock successful publishing
      contentPublisherService.publishContentWithMedia.mockResolvedValue({
        ...mockPublishResult,
        status: PublishStatus.COMPLETED,
      });

      await service.processScheduledPosts();

      expect(scheduledPostRepo.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: ScheduleStatus.PUBLISHED,
        }),
      );
    });

    it('should map PublishStatus.PARTIALLY_COMPLETED to ScheduleStatus.PARTIALLY_PUBLISHED', async () => {
      // Mock finding a pending post
      scheduledPostRepo.find.mockResolvedValue([mockScheduledPost]);

      // Mock partially successful publishing
      contentPublisherService.publishContentWithMedia.mockResolvedValue({
        ...mockPublishResult,
        status: PublishStatus.PARTIALLY_COMPLETED,
      });

      await service.processScheduledPosts();

      expect(scheduledPostRepo.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: ScheduleStatus.PARTIALLY_PUBLISHED,
        }),
      );
    });

    it('should map PublishStatus.FAILED to ScheduleStatus.FAILED', async () => {
      // Mock finding a pending post
      scheduledPostRepo.find.mockResolvedValue([mockScheduledPost]);

      // Mock failed publishing
      contentPublisherService.publishContentWithMedia.mockResolvedValue({
        ...mockPublishResult,
        status: PublishStatus.FAILED,
      });

      await service.processScheduledPosts();

      expect(scheduledPostRepo.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: ScheduleStatus.FAILED,
        }),
      );
    });
  });
});
