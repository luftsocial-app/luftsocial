import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContentPublisherService } from './content-publisher.service';
import { FacebookService } from '../../platforms/facebook/facebook.service';
import { InstagramService } from '../../platforms/instagram/instagram.service';
import { LinkedInService } from '../../platforms/linkedin/linkedin.service';
import { TikTokService } from '../../platforms/tiktok/tiktok.service';
import { MediaStorageService } from '../../asset-management/media-storage/media-storage.service';
import { PublishRecord } from '../entity/publish.entity';
import { SocialPlatform } from '../../common/enums/social-platform.enum';
import { PublishStatus } from '../helpers/cross-platform.interface';

describe('ContentPublisherService', () => {
  let service: ContentPublisherService;
  let publishRepo: jest.Mocked<Repository<PublishRecord>>;
  let facebookService: jest.Mocked<FacebookService>;
  let instagramService: jest.Mocked<InstagramService>;
  let linkedinService: jest.Mocked<LinkedInService>;
  let tiktokService: jest.Mocked<TikTokService>;
  let mediaStorageService: jest.Mocked<MediaStorageService>;

  const mockUserId = 'user123';
  const mockPublishId = 'publish123';
  const mockContent = 'Test content for social media post';
  const mockScheduleTime = new Date();

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

  // Mock platform responses
  const mockFacebookResponse = {
    platformPostId: 'fb_post_123',
    postedAt: new Date(),
  };

  const mockInstagramResponse = {
    platformPostId: 'ig_post_123',
    postedAt: new Date(),
  };

  const mockLinkedInResponse = {
    platformPostId: 'li_post_123',
    postedAt: new Date(),
  };

  const mockTikTokResponse = {
    platformPostId: 'tt_post_123',
    postedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentPublisherService,
        {
          provide: getRepositoryToken(PublishRecord),
          useValue: {
            save: jest.fn(),
            update: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: FacebookService,
          useValue: {
            post: jest.fn(),
          },
        },
        {
          provide: InstagramService,
          useValue: {
            post: jest.fn(),
          },
        },
        {
          provide: LinkedInService,
          useValue: {
            post: jest.fn(),
          },
        },
        {
          provide: TikTokService,
          useValue: {
            post: jest.fn(),
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

    service = module.get<ContentPublisherService>(ContentPublisherService);
    publishRepo = module.get(getRepositoryToken(PublishRecord)) as jest.Mocked<
      Repository<PublishRecord>
    >;
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
    mediaStorageService = module.get(
      MediaStorageService,
    ) as jest.Mocked<MediaStorageService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publishContentWithMedia', () => {
    beforeEach(() => {
      // Set up successful repository responses
      publishRepo.save.mockResolvedValue({
        id: mockPublishId,
        userId: mockUserId,
        content: mockContent,
        platforms: [],
        scheduleTime: mockScheduleTime,
        status: PublishStatus.PENDING,
      });

      // Mock successful media uploads
      mediaStorageService.uploadPostMedia.mockResolvedValue([mockUploadedFile]);
      mediaStorageService.uploadMediaFromUrl.mockResolvedValue(mockUploadedUrl);

      // Mock successful platform posts
      facebookService.post.mockResolvedValue(mockFacebookResponse);
      instagramService.post.mockResolvedValue(mockInstagramResponse);
      linkedinService.post.mockResolvedValue(mockLinkedInResponse);
      tiktokService.post.mockResolvedValue(mockTikTokResponse);
    });

    it('should successfully publish content to Facebook with file upload', async () => {
      const result = await service.publishContentWithMedia({
        userId: mockUserId,
        content: mockContent,
        platforms: [{ platform: SocialPlatform.FACEBOOK, accountId: 'fb123' }],
        files: [mockFile],
        scheduleTime: mockScheduleTime,
      });

      // Verify repository interactions
      expect(publishRepo.save).toHaveBeenCalledWith({
        userId: mockUserId,
        content: mockContent,
        platforms: [{ platform: SocialPlatform.FACEBOOK, accountId: 'fb123' }],
        scheduleTime: mockScheduleTime,
        status: PublishStatus.PENDING,
      });

      expect(publishRepo.update).toHaveBeenCalledTimes(2);

      // Verify media upload
      expect(mediaStorageService.uploadPostMedia).toHaveBeenCalledWith(
        mockUserId,
        [mockFile],
        mockPublishId,
      );

      // Verify Facebook post
      expect(facebookService.post).toHaveBeenCalledWith(
        'fb123',
        mockContent,
        expect.arrayContaining([
          expect.objectContaining({
            file: mockFile,
          }),
        ]),
      );

      // Verify result structure
      expect(result).toEqual({
        publishId: mockPublishId,
        status: PublishStatus.COMPLETED,
        mediaItems: [mockUploadedFile],
        results: [
          {
            platform: SocialPlatform.FACEBOOK,
            accountId: 'fb123',
            success: true,
            postId: mockFacebookResponse.platformPostId,
            postedAt: mockFacebookResponse.postedAt,
          },
        ],
      });
    });

    it('should successfully publish content to multiple platforms with media URL', async () => {
      const result = await service.publishContentWithMedia({
        userId: mockUserId,
        content: mockContent,
        platforms: [
          { platform: SocialPlatform.FACEBOOK, accountId: 'fb123' },
          {
            platform: SocialPlatform.INSTAGRAM,
            accountId: 'ig123',
            platformSpecificParams: { caption: 'Instagram caption' },
          },
        ],
        mediaUrls: [mockMediaUrl],
        scheduleTime: mockScheduleTime,
      });

      // Verify media upload
      expect(mediaStorageService.uploadMediaFromUrl).toHaveBeenCalledWith(
        mockUserId,
        mockMediaUrl,
        mockPublishId,
      );

      // Verify platform posts
      expect(facebookService.post).toHaveBeenCalled();
      expect(instagramService.post).toHaveBeenCalled();

      // Verify result status is COMPLETED
      expect(result.status).toBe(PublishStatus.COMPLETED);
      expect(result.results.length).toBe(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
    });

    it('should handle failure on a single platform and mark as PARTIALLY_COMPLETED', async () => {
      // Make Instagram service throw an error
      instagramService.post.mockRejectedValue(new Error('Instagram API error'));

      const result = await service.publishContentWithMedia({
        userId: mockUserId,
        content: mockContent,
        platforms: [
          { platform: SocialPlatform.FACEBOOK, accountId: 'fb123' },
          { platform: SocialPlatform.INSTAGRAM, accountId: 'ig123' },
        ],
        files: [mockFile],
        scheduleTime: mockScheduleTime,
      });

      // Verify result status is PARTIALLY_COMPLETED
      expect(result.status).toBe(PublishStatus.PARTIALLY_COMPLETED);
      expect(result.results.length).toBe(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toBe('Instagram API error');
    });

    it('should handle failure on all platforms and mark as FAILED', async () => {
      // Make all services throw errors
      facebookService.post.mockRejectedValue(new Error('Facebook API error'));
      instagramService.post.mockRejectedValue(new Error('Instagram API error'));

      const result = await service.publishContentWithMedia({
        userId: mockUserId,
        content: mockContent,
        platforms: [
          { platform: SocialPlatform.FACEBOOK, accountId: 'fb123' },
          { platform: SocialPlatform.INSTAGRAM, accountId: 'ig123' },
        ],
        files: [mockFile],
        scheduleTime: mockScheduleTime,
      });

      // Verify result status is FAILED
      expect(result.status).toBe(PublishStatus.FAILED);
      expect(result.results.length).toBe(2);
      expect(result.results[0].success).toBe(false);
      expect(result.results[1].success).toBe(false);
    });

    it('should throw BadRequestException when publishing to Instagram without media', async () => {
      const result = await service.publishContentWithMedia({
        userId: mockUserId,
        content: mockContent,
        platforms: [{ platform: SocialPlatform.INSTAGRAM, accountId: 'ig123' }],
        // No files or media URLs provided
        scheduleTime: mockScheduleTime,
      });

      expect(result.status).toBe(PublishStatus.FAILED);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain(
        'Instagram requires at least one media',
      );
    });

    it('should throw BadRequestException when publishing to TikTok without media', async () => {
      const result = await service.publishContentWithMedia({
        userId: mockUserId,
        content: mockContent,
        platforms: [{ platform: SocialPlatform.TIKTOK, accountId: 'tt123' }],
        // No files or media URLs provided
        scheduleTime: mockScheduleTime,
      });

      expect(result.status).toBe(PublishStatus.FAILED);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('TikTok requires a video');
    });

    it('should throw BadRequestException for unsupported platform', async () => {
      const invalidPlatform = 'MYSPACE' as SocialPlatform;

      const result = await service.publishContentWithMedia({
        userId: mockUserId,
        content: mockContent,
        platforms: [{ platform: invalidPlatform, accountId: 'myspace123' }],
        files: [mockFile],
        scheduleTime: mockScheduleTime,
      });

      expect(result.status).toBe(PublishStatus.FAILED);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('Unsupported platform');
    });
  });

  describe('getPublishStatus', () => {
    it('should return the status of a publish record', async () => {
      publishRepo.findOne.mockResolvedValue({
        id: mockPublishId,
        userId: mockUserId,
        status: PublishStatus.COMPLETED,
      } as PublishRecord);

      const result = await service.getPublishStatus(mockPublishId, mockUserId);

      expect(result).toBe(PublishStatus.COMPLETED);
      expect(publishRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockPublishId, userId: mockUserId },
      });
    });

    it('should throw NotFoundException when publish record is not found', async () => {
      publishRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getPublishStatus(mockPublishId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('publishToPlatform (private method indirectly tested)', () => {
    it('should publish to Facebook with the correct parameters', async () => {
      await service.publishContentWithMedia({
        userId: mockUserId,
        content: mockContent,
        platforms: [{ platform: SocialPlatform.FACEBOOK, accountId: 'fb123' }],
        files: [mockFile],
      });

      expect(facebookService.post).toHaveBeenCalledWith(
        'fb123',
        mockContent,
        expect.arrayContaining([
          expect.objectContaining({
            file: mockFile,
          }),
        ]),
      );
    });

    it('should publish to Instagram with the correct parameters and platformSpecificParams', async () => {
      const platformSpecificParams = { caption: 'Instagram caption' };

      await service.publishContentWithMedia({
        userId: mockUserId,
        content: mockContent,
        platforms: [
          {
            platform: SocialPlatform.INSTAGRAM,
            accountId: 'ig123',
            platformSpecificParams,
          },
        ],
        files: [mockFile],
      });

      expect(instagramService.post).toHaveBeenCalledWith(
        'ig123',
        platformSpecificParams,
        expect.arrayContaining([
          expect.objectContaining({
            file: mockFile,
          }),
        ]),
      );
    });

    it('should publish to LinkedIn with the correct parameters', async () => {
      const platformSpecificParams = { visibility: 'public' };

      await service.publishContentWithMedia({
        userId: mockUserId,
        content: mockContent,
        platforms: [
          {
            platform: SocialPlatform.LINKEDIN,
            accountId: 'li123',
            platformSpecificParams,
          },
        ],
        files: [mockFile],
      });

      expect(linkedinService.post).toHaveBeenCalledWith(
        'li123',
        platformSpecificParams,
        expect.arrayContaining([
          expect.objectContaining({
            file: mockFile,
          }),
        ]),
      );
    });

    it('should publish to TikTok with the correct parameters', async () => {
      const platformSpecificParams = { description: 'TikTok video' };

      await service.publishContentWithMedia({
        userId: mockUserId,
        content: mockContent,
        platforms: [
          {
            platform: SocialPlatform.TIKTOK,
            accountId: 'tt123',
            platformSpecificParams,
          },
        ],
        files: [mockFile],
      });

      expect(tiktokService.post).toHaveBeenCalledWith(
        'tt123',
        platformSpecificParams,
        expect.arrayContaining([
          expect.objectContaining({
            file: mockFile,
          }),
        ]),
      );
    });
  });

  describe('determineOverallStatus (private method indirectly tested)', () => {
    it('should return COMPLETED when all platforms succeed', async () => {
      const result = await service.publishContentWithMedia({
        userId: mockUserId,
        content: mockContent,
        platforms: [
          { platform: SocialPlatform.FACEBOOK, accountId: 'fb123' },
          { platform: SocialPlatform.LINKEDIN, accountId: 'li123' },
        ],
        files: [mockFile],
      });

      expect(result.status).toBe(PublishStatus.COMPLETED);
    });

    it('should return PARTIALLY_COMPLETED when some platforms succeed and some fail', async () => {
      linkedinService.post.mockRejectedValue(new Error('LinkedIn API error'));

      const result = await service.publishContentWithMedia({
        userId: mockUserId,
        content: mockContent,
        platforms: [
          { platform: SocialPlatform.FACEBOOK, accountId: 'fb123' },
          { platform: SocialPlatform.LINKEDIN, accountId: 'li123' },
        ],
        files: [mockFile],
      });

      expect(result.status).toBe(PublishStatus.PARTIALLY_COMPLETED);
    });

    it('should return FAILED when all platforms fail', async () => {
      facebookService.post.mockRejectedValue(new Error('Facebook API error'));
      linkedinService.post.mockRejectedValue(new Error('LinkedIn API error'));

      const result = await service.publishContentWithMedia({
        userId: mockUserId,
        content: mockContent,
        platforms: [
          { platform: SocialPlatform.FACEBOOK, accountId: 'fb123' },
          { platform: SocialPlatform.LINKEDIN, accountId: 'li123' },
        ],
        files: [mockFile],
      });

      expect(result.status).toBe(PublishStatus.FAILED);
    });
  });
});
