import { Test, TestingModule } from '@nestjs/testing';
import { ContentPublisherService } from './content-publisher.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PublishRecord } from '../entities/publish.entity';
import { FacebookService } from '../../platforms/facebook/facebook.service';
import { InstagramService } from '../../platforms/instagram/instagram.service';
import { LinkedInService } from '../../platforms/linkedin/linkedin.service';
import { TikTokService } from '../../platforms/tiktok/tiktok.service';
import { MediaStorageService } from '../../asset-management/media-storage/media-storage.service';
import { RetryQueueService } from './retry-queue.service';
import { PinoLogger } from 'nestjs-pino';
import { getQueueToken } from '@nestjs/bull';
import { PublishStatus } from '../helpers/cross-platform.interface';
import { HttpException, NotFoundException } from '@nestjs/common';
import { SocialPlatform } from '../../common/enums/social-platform.enum';
import { CreateCrossPlatformPostDto } from '../helpers/dtos/cross-platform.dto';
import axios from 'axios';

// Mock the axios module
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ContentPublisherService', () => {
  let service: ContentPublisherService;

  const mockPublishRepo = {
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(10),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };

  const mockFacebookService = {
    createPagePost: jest.fn(),
  };

  const mockInstagramService = {
    post: jest.fn(),
  };

  const mockLinkedinService = {
    post: jest.fn(),
  };

  const mockTiktokService = {
    post: jest.fn(),
  };

  const mockMediaStorageService = {
    calculateFileHash: jest.fn(),
    findMediaByHash: jest.fn(),
    uploadPostMedia: jest.fn(),
    uploadMediaFromUrl: jest.fn(),
  };

  const mockRetryQueueService = {
    addToRetryQueue: jest.fn(),
  };

  const mockPublishQueue = {
    add: jest.fn(),
  };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentPublisherService,
        {
          provide: getRepositoryToken(PublishRecord),
          useValue: mockPublishRepo,
        },
        {
          provide: FacebookService,
          useValue: mockFacebookService,
        },
        {
          provide: InstagramService,
          useValue: mockInstagramService,
        },
        {
          provide: LinkedInService,
          useValue: mockLinkedinService,
        },
        {
          provide: TikTokService,
          useValue: mockTiktokService,
        },
        {
          provide: MediaStorageService,
          useValue: mockMediaStorageService,
        },
        {
          provide: RetryQueueService,
          useValue: mockRetryQueueService,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
        {
          provide: getQueueToken('platform-publish'),
          useValue: mockPublishQueue,
        },
      ],
    }).compile();

    service = module.get<ContentPublisherService>(ContentPublisherService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateFiles', () => {
    it('should pass validation for allowed file types and sizes', () => {
      const files = [
        {
          mimetype: 'image/jpeg',
          size: 1024 * 1024, // 1MB
          originalname: 'test.jpg',
        },
        {
          mimetype: 'video/mp4',
          size: 10 * 1024 * 1024, // 10MB
          originalname: 'test.mp4',
        },
      ] as Express.Multer.File[];

      expect(() => service.validateFiles(files)).not.toThrow();
    });

    it('should throw exception for unsupported file type', () => {
      const files = [
        {
          mimetype: 'application/exe',
          size: 1024 * 1024,
          originalname: 'malicious.exe',
        },
      ] as Express.Multer.File[];

      expect(() => service.validateFiles(files)).toThrow(HttpException);
      expect(() => service.validateFiles(files)).toThrow(
        'File validation failed',
      );
    });

    it('should throw exception for file exceeding size limit', () => {
      const files = [
        {
          mimetype: 'image/jpeg',
          size: 60 * 1024 * 1024, // 60MB, exceeds 50MB limit
          originalname: 'large_image.jpg',
        },
      ] as Express.Multer.File[];

      expect(() => service.validateFiles(files)).toThrow(HttpException);
      expect(() => service.validateFiles(files)).toThrow(
        'File validation failed',
      );
    });
  });

  describe('validateMediaRequirements', () => {
    beforeEach(() => {
      mockedAxios.head.mockResolvedValue({
        headers: { 'content-type': 'image/jpeg' },
      });
    });

    it('should pass validation for valid Instagram media requirements', async () => {
      const dto: CreateCrossPlatformPostDto = {
        content: 'Test content',
        platforms: [
          {
            platform: SocialPlatform.INSTAGRAM,
            accountId: '',
          },
        ],
        mediaUrls: [],
      };

      const files = [
        {
          mimetype: 'image/jpeg',
          originalname: 'test.jpg',
        },
      ] as Express.Multer.File[];

      await expect(
        service.validateMediaRequirements(dto, files),
      ).resolves.not.toThrow();
    });

    it('should throw exception for missing media with Instagram', async () => {
      const dto: CreateCrossPlatformPostDto = {
        content: 'Test content',
        platforms: [
          {
            platform: SocialPlatform.INSTAGRAM,
            accountId: '23232',
          },
        ],
        mediaUrls: [],
      };

      const files = [] as Express.Multer.File[];

      await expect(
        service.validateMediaRequirements(dto, files),
      ).rejects.toThrow(HttpException);
      await expect(
        service.validateMediaRequirements(dto, files),
      ).rejects.toThrow('Media validation failed');
    });

    it('should throw exception for unsupported media type with TikTok', async () => {
      const dto: CreateCrossPlatformPostDto = {
        content: 'Test content',
        platforms: [
          {
            platform: SocialPlatform.TIKTOK,
            accountId: '',
          },
        ],
        mediaUrls: [],
      };

      const files = [
        {
          mimetype: 'image/jpeg', // TikTok only supports video/mp4
          originalname: 'test.jpg',
        },
      ] as Express.Multer.File[];

      await expect(
        service.validateMediaRequirements(dto, files),
      ).rejects.toThrow(HttpException);
      await expect(
        service.validateMediaRequirements(dto, files),
      ).rejects.toThrow('Media validation failed');
    });

    it('should validate media URLs correctly', async () => {
      mockedAxios.head.mockResolvedValue({
        headers: { 'content-type': 'video/mp4' },
      });

      const dto: CreateCrossPlatformPostDto = {
        content: 'Test content',
        platforms: [
          {
            platform: SocialPlatform.TIKTOK,
            accountId: '',
          },
        ],
        mediaUrls: ['http://example.com/video.mp4'],
      };

      const files = [] as Express.Multer.File[];

      await expect(
        service.validateMediaRequirements(dto, files),
      ).resolves.not.toThrow();
    });

    it('should handle media URL fetch failures gracefully', async () => {
      mockedAxios.head.mockRejectedValue(new Error('Network error'));

      const dto: CreateCrossPlatformPostDto = {
        content: 'Test content',
        platforms: [
          {
            platform: SocialPlatform.TIKTOK,
            accountId: '',
          },
        ],
        mediaUrls: ['http://example.com/bad-url.mp4'],
      };

      const files = [] as Express.Multer.File[];

      await expect(
        service.validateMediaRequirements(dto, files),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('publishContentWithMedia', () => {
    it('should successfully publish content to all platforms', async () => {
      // Mock repository responses
      mockPublishRepo.save.mockResolvedValue({
        id: 'publish-123',
        userId: 'user-123',
        status: PublishStatus.PENDING,
      });

      // Mock media storage responses
      mockMediaStorageService.calculateFileHash.mockResolvedValue('hash-123');
      mockMediaStorageService.findMediaByHash.mockResolvedValue(null);
      mockMediaStorageService.uploadPostMedia.mockResolvedValue([
        {
          id: 'media-123',
          url: 'https://example.com/media.jpg',
          type: 'image/jpeg',
        },
      ]);

      // Mock platform service responses
      mockFacebookService.createPagePost.mockResolvedValue({
        platformPostId: 'fb-post-123',
        postedAt: new Date(),
      });

      // Setup params
      const params = {
        userId: 'user-123',
        content: 'Test content',
        platforms: [
          {
            platform: SocialPlatform.FACEBOOK,
            accountId: 'fb-123',
            platformSpecificParams: { pageId: 'page-123' },
          },
        ],
        files: [
          {
            mimetype: 'image/jpeg',
            originalname: 'test.jpg',
            buffer: Buffer.from('test'),
          },
        ] as Express.Multer.File[],
      };

      const result = await service.publishContentWithMedia(params);

      // Verify correct function calls
      expect(mockPublishRepo.save).toHaveBeenCalled();
      expect(mockMediaStorageService.calculateFileHash).toHaveBeenCalled();
      expect(mockMediaStorageService.uploadPostMedia).toHaveBeenCalled();
      expect(mockFacebookService.createPagePost).toHaveBeenCalled();
      expect(mockPublishRepo.update).toHaveBeenCalled();

      // Verify result structure
      expect(result).toHaveProperty('publishId', 'publish-123');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('mediaItems');
      expect(result).toHaveProperty('results');
    });

    it('should handle platform publishing failures and add to retry queue', async () => {
      // Mock repository responses
      mockPublishRepo.save.mockResolvedValue({
        id: 'publish-123',
        userId: 'user-123',
        status: PublishStatus.PENDING,
      });

      // Mock media storage
      mockMediaStorageService.calculateFileHash.mockResolvedValue('hash-123');
      mockMediaStorageService.findMediaByHash.mockResolvedValue(null);
      mockMediaStorageService.uploadPostMedia.mockResolvedValue([
        {
          id: 'media-123',
          url: 'https://example.com/media.jpg',
          type: 'image/jpeg',
        },
      ]);

      // Mock platform failure
      mockFacebookService.createPagePost.mockRejectedValue(
        new Error('API rate limit exceeded'),
      );

      // Setup params
      const params = {
        userId: 'user-123',
        content: 'Test content',
        platforms: [
          {
            platform: SocialPlatform.FACEBOOK,
            accountId: 'fb-123',
            platformSpecificParams: { pageId: 'page-123' },
          },
        ],
        files: [
          {
            mimetype: 'image/jpeg',
            originalname: 'test.jpg',
            buffer: Buffer.from('test'),
          },
        ] as Express.Multer.File[],
      };

      const result = await service.publishContentWithMedia(params);

      console.log({ testResult: result.results });

      // Verify retry queue was called
      expect(mockRetryQueueService.addToRetryQueue).toHaveBeenCalled();
      expect(result.status).toBe(PublishStatus.FAILED);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0]['scheduled_for_retry']).toBe(true);
    });

    it('should reuse existing media with same hash', async () => {
      // Mock repository
      mockPublishRepo.save.mockResolvedValue({
        id: 'publish-123',
        userId: 'user-123',
        status: PublishStatus.PENDING,
      });

      // Mock existing media found
      const existingMedia = {
        id: 'existing-media-123',
        url: 'https://example.com/existing.jpg',
        type: 'image/jpeg',
      };
      mockMediaStorageService.calculateFileHash.mockResolvedValue(
        'existing-hash',
      );
      mockMediaStorageService.findMediaByHash.mockResolvedValue(existingMedia);

      // Mock successful platform post
      mockFacebookService.createPagePost.mockResolvedValue({
        platformPostId: 'fb-post-123',
        postedAt: new Date(),
      });

      // Setup params
      const params = {
        userId: 'user-123',
        content: 'Test content',
        platforms: [
          {
            platform: SocialPlatform.FACEBOOK,
            accountId: 'fb-123',
            platformSpecificParams: { pageId: 'page-123' },
          },
        ],
        files: [
          {
            mimetype: 'image/jpeg',
            originalname: 'test.jpg',
            buffer: Buffer.from('test'),
          },
        ] as Express.Multer.File[],
      };

      await service.publishContentWithMedia(params);

      // Verify existing media was used instead of uploading new
      expect(mockMediaStorageService.uploadPostMedia).not.toHaveBeenCalled();
      expect(mockFacebookService.createPagePost).toHaveBeenCalledWith(
        'page-123',
        expect.objectContaining({
          media: expect.arrayContaining([existingMedia]),
        }),
      );
    });

    it('should handle media upload failures gracefully', async () => {
      // Mock repository
      mockPublishRepo.save.mockResolvedValue({
        id: 'publish-123',
        userId: 'user-123',
        status: PublishStatus.PENDING,
      });

      // Mock media upload failure
      mockMediaStorageService.calculateFileHash.mockResolvedValue('hash-123');
      mockMediaStorageService.findMediaByHash.mockResolvedValue(null);
      mockMediaStorageService.uploadPostMedia.mockRejectedValue(
        new Error('Storage error'),
      );

      // Setup params with multiple files - one will fail, one should succeed
      const params = {
        userId: 'user-123',
        content: 'Test content',
        platforms: [
          {
            platform: SocialPlatform.FACEBOOK,
            accountId: 'fb-123',
            platformSpecificParams: { pageId: 'page-123' },
          },
        ],
        files: [
          {
            mimetype: 'image/jpeg',
            originalname: 'test.jpg',
            buffer: Buffer.from('test'),
          },
        ] as Express.Multer.File[],
        mediaUrls: ['https://example.com/image.jpg'],
      };

      // Mock URL upload success
      mockMediaStorageService.uploadMediaFromUrl.mockResolvedValue({
        id: 'url-media-123',
        url: 'https://example.com/stored-image.jpg',
        type: 'image/jpeg',
      });

      // Should continue despite one upload failing
      await service.publishContentWithMedia(params);

      // Should have attempted both uploads
      expect(mockMediaStorageService.uploadPostMedia).toHaveBeenCalled();
      expect(mockMediaStorageService.uploadMediaFromUrl).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getPublishStatus', () => {
    it('should return the status of a publish record', async () => {
      mockPublishRepo.findOne.mockResolvedValue({
        id: 'publish-123',
        userId: 'user-123',
        status: PublishStatus.COMPLETED,
      });

      const status = await service.getPublishStatus('publish-123', 'user-123');

      expect(status).toBe(PublishStatus.COMPLETED);
      expect(mockPublishRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'publish-123', userId: 'user-123' },
      });
    });

    it('should throw NotFoundException when record not found', async () => {
      mockPublishRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getPublishStatus('non-existent', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('retryPublish', () => {
    it('should add failed publish to retry queue', async () => {
      mockPublishRepo.findOne.mockResolvedValue({
        id: 'publish-123',
        userId: 'user-123',
        content: 'Test content',
        status: PublishStatus.PARTIALLY_COMPLETED,
        mediaItems: [{ url: 'https://example.com/media.jpg' }],
        platforms: [
          {
            platform: 'facebook',
            accountId: 'account-123',
            platformSpecificParams: { pageId: 'page-123' },
          },
        ],
      });

      const result = await service.retryPublish(
        'publish-123',
        'facebook',
        'account-123',
      );

      expect(result).toBe(true);
      expect(mockPublishQueue.add).toHaveBeenCalledWith(
        'retry-platform-publish',
        expect.objectContaining({
          publishRecordId: 'publish-123',
          platform: 'facebook',
          accountId: 'account-123',
        }),
        expect.any(Object),
      );
    });

    it('should throw NotFoundException when record not found', async () => {
      mockPublishRepo.findOne.mockResolvedValue(null);

      await expect(
        service.retryPublish('non-existent', 'facebook', 'account-123'),
      ).resolves.toBe(false);

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('findUserPublishRecords', () => {
    it('should return paginated publish records', async () => {
      const mockRecords = [
        {
          id: 'publish-1',
          userId: 'user-123',
          status: PublishStatus.COMPLETED,
        },
        {
          id: 'publish-2',
          userId: 'user-123',
          status: PublishStatus.FAILED,
        },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockRecords),
        getCount: jest.fn().mockResolvedValue(2),
      };

      mockPublishRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findUserPublishRecords('user-123', 1, 10);

      expect(result).toEqual({
        items: mockRecords,
        total: 2,
        page: 1,
        limit: 10,
      });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'publish.userId = :userId',
        { userId: 'user-123' },
      );
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0); // (page-1)*limit
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should filter by status when provided', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0),
      };

      mockPublishRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findUserPublishRecords(
        'user-123',
        1,
        10,
        PublishStatus.COMPLETED,
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'publish.status = :status',
        { status: PublishStatus.COMPLETED },
      );
    });

    it('should handle errors gracefully', async () => {
      mockPublishRepo.createQueryBuilder.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await service.findUserPublishRecords('user-123');

      expect(result).toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
      });
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('updatePublishStatus', () => {
    it('should update publish status successfully', async () => {
      mockPublishRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.updatePublishStatus(
        'publish-123',
        PublishStatus.COMPLETED,
      );

      expect(result).toBe(true);
      expect(mockPublishRepo.update).toHaveBeenCalledWith(
        { id: 'publish-123' },
        { status: PublishStatus.COMPLETED },
      );
    });

    it('should return false when no records affected', async () => {
      mockPublishRepo.update.mockResolvedValue({ affected: 0 });

      const result = await service.updatePublishStatus(
        'non-existent',
        PublishStatus.COMPLETED,
      );

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockPublishRepo.update.mockRejectedValue(new Error('Database error'));

      const result = await service.updatePublishStatus(
        'publish-123',
        PublishStatus.COMPLETED,
      );

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('findPublishById', () => {
    it('should return a publish record when found', async () => {
      const mockRecord = {
        id: 'publish-123',
        userId: 'user-123',
        status: PublishStatus.COMPLETED,
      };

      mockPublishRepo.findOne.mockResolvedValue(mockRecord);

      const result = await service.findPublishById('publish-123', 'user-123');

      expect(result).toEqual(mockRecord);
      expect(mockPublishRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'publish-123', userId: 'user-123' },
      });
    });

    it('should return null when record not found', async () => {
      mockPublishRepo.findOne.mockResolvedValue(null);

      const result = await service.findPublishById('non-existent', 'user-123');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockPublishRepo.findOne.mockRejectedValue(new Error('Database error'));

      const result = await service.findPublishById('publish-123', 'user-123');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});