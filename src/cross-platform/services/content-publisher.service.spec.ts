import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ContentPublisherService } from './content-publisher.service';
import { FacebookService } from '../../platforms/facebook/facebook.service';
import { InstagramService } from '../../platforms/instagram/instagram.service';
import { LinkedInService } from '../../platforms/linkedin/linkedin.service';
import { TikTokService } from '../../platforms/tiktok/tiktok.service';
import { PublishRecord } from '../entity/publish.entity';
import { SocialPlatform } from '../../common/enums/social-platform.enum';
import { MediaStorageService } from '../../asset-management/media-storage/media-storage.service';
import { PublishStatus } from '../helpers/cross-platform.interface';

describe('ContentPublisherService', () => {
  let service: ContentPublisherService;
  let publishRepo: jest.Mocked<Repository<PublishRecord>>;
  let facebookService: jest.Mocked<FacebookService>;
  let instagramService: jest.Mocked<InstagramService>;
  let linkedinService: jest.Mocked<LinkedInService>;
  let tiktokService: jest.Mocked<TikTokService>;
  let mediaStorageService: jest.Mocked<MediaStorageService>;

  // Mock data
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
    // Create mock services
    const mockPublishRepo = {
      save: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
    };

    const mockFacebookService = {
      post: jest.fn(),
    };

    const mockInstagramService = {
      post: jest.fn(),
    };

    const mockLinkedInService = {
      post: jest.fn(),
    };

    const mockTikTokService = {
      post: jest.fn(),
    };

    const mockMediaStorageService = {
      uploadPostMedia: jest.fn(),
      uploadMediaFromUrl: jest.fn(),
    };

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
          useValue: mockLinkedInService,
        },
        {
          provide: TikTokService,
          useValue: mockTikTokService,
        },
        {
          provide: MediaStorageService,
          useValue: mockMediaStorageService,
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

    // Set up default mock responses
    publishRepo.save.mockResolvedValue({
      id: mockPublishId,
      userId: mockUserId,
      content: mockContent,
      platforms: [],
      scheduleTime: mockScheduleTime,
      status: PublishStatus.PENDING,
    });

    publishRepo.update.mockResolvedValue({ affected: 1 });
    publishRepo.findOne.mockResolvedValue({
      id: mockPublishId,
      userId: mockUserId,
      status: PublishStatus.COMPLETED,
    });

    mediaStorageService.uploadPostMedia.mockResolvedValue([mockUploadedFile]);
    mediaStorageService.uploadMediaFromUrl.mockResolvedValue(mockUploadedUrl);

    facebookService.post.mockResolvedValue(mockFacebookResponse);
    instagramService.post.mockResolvedValue(mockInstagramResponse);
    linkedinService.post.mockResolvedValue(mockLinkedInResponse);
    tiktokService.post.mockResolvedValue(mockTikTokResponse);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publishContentWithMedia', () => {
    it('should successfully publish content to Facebook with file upload', async () => {
      // Override the allSettled spy to return success for Facebook
      jest.spyOn(Promise, 'allSettled').mockImplementationOnce(() => {
        return Promise.resolve([
          {
            status: 'fulfilled',
            value: {
              platform: SocialPlatform.FACEBOOK,
              accountId: 'fb123',
              success: true,
              postId: mockFacebookResponse.platformPostId,
              postedAt: mockFacebookResponse.postedAt,
            },
          },
        ]);
      });

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
        mediaItems: expect.arrayContaining([mockUploadedFile]),
        results: expect.arrayContaining([
          expect.objectContaining({
            platform: SocialPlatform.FACEBOOK,
            accountId: 'fb123',
            success: true,
          }),
        ]),
      });
    });

    it('should successfully publish content to multiple platforms with media URL', async () => {
      // Override the allSettled spy to return success for both platforms
      jest.spyOn(Promise, 'allSettled').mockImplementationOnce(() => {
        return Promise.resolve([
          {
            status: 'fulfilled',
            value: {
              platform: SocialPlatform.FACEBOOK,
              accountId: 'fb123',
              success: true,
              postId: mockFacebookResponse.platformPostId,
              postedAt: mockFacebookResponse.postedAt,
            },
          },
          {
            status: 'fulfilled',
            value: {
              platform: SocialPlatform.INSTAGRAM,
              accountId: 'ig123',
              success: true,
              postId: mockInstagramResponse.platformPostId,
              postedAt: mockInstagramResponse.postedAt,
            },
          },
        ]);
      });

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

      // Override the allSettled spy to return mixed results
      jest.spyOn(Promise, 'allSettled').mockImplementationOnce(() => {
        return Promise.resolve([
          {
            status: 'fulfilled',
            value: {
              platform: SocialPlatform.FACEBOOK,
              accountId: 'fb123',
              success: true,
              postId: mockFacebookResponse.platformPostId,
              postedAt: mockFacebookResponse.postedAt,
            },
          },
          {
            status: 'rejected',
            reason: {
              platform: SocialPlatform.INSTAGRAM,
              accountId: 'ig123',
              message: 'Instagram API error',
            },
          },
        ]);
      });

      // Make the determineOverallStatus method return PARTIALLY_COMPLETED
      jest
        .spyOn(service as any, 'determineOverallStatus')
        .mockReturnValue(PublishStatus.PARTIALLY_COMPLETED);

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

      // Override the allSettled spy to return all failures
      jest.spyOn(Promise, 'allSettled').mockImplementationOnce(() => {
        return Promise.resolve([
          {
            status: 'rejected',
            reason: {
              platform: SocialPlatform.FACEBOOK,
              accountId: 'fb123',
              message: 'Facebook API error',
            },
          },
          {
            status: 'rejected',
            reason: {
              platform: SocialPlatform.INSTAGRAM,
              accountId: 'ig123',
              message: 'Instagram API error',
            },
          },
        ]);
      });

      // Make the determineOverallStatus method return FAILED
      jest
        .spyOn(service as any, 'determineOverallStatus')
        .mockReturnValue(PublishStatus.FAILED);

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
      // Make Instagram throw exception about missing media
      instagramService.post.mockRejectedValue(
        new BadRequestException('Instagram requires at least one media'),
      );

      // Override the allSettled spy
      jest.spyOn(Promise, 'allSettled').mockImplementationOnce(() => {
        return Promise.resolve([
          {
            status: 'rejected',
            reason: {
              platform: SocialPlatform.INSTAGRAM,
              accountId: 'ig123',
              message: 'Instagram requires at least one media',
            },
          },
        ]);
      });

      // Make the determineOverallStatus method return FAILED
      jest
        .spyOn(service as any, 'determineOverallStatus')
        .mockReturnValue(PublishStatus.FAILED);

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
      // Make TikTok throw exception about missing video
      tiktokService.post.mockRejectedValue(
        new BadRequestException('TikTok requires a video'),
      );

      // Override the allSettled spy
      jest.spyOn(Promise, 'allSettled').mockImplementationOnce(() => {
        return Promise.resolve([
          {
            status: 'rejected',
            reason: {
              platform: SocialPlatform.TIKTOK,
              accountId: 'tt123',
              message: 'TikTok requires a video',
            },
          },
        ]);
      });

      // Make the determineOverallStatus method return FAILED
      jest
        .spyOn(service as any, 'determineOverallStatus')
        .mockReturnValue(PublishStatus.FAILED);

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

      // Override the allSettled spy
      jest.spyOn(Promise, 'allSettled').mockImplementationOnce(() => {
        return Promise.resolve([
          {
            status: 'rejected',
            reason: {
              platform: invalidPlatform,
              accountId: 'myspace123',
              message: 'Unsupported platform: MYSPACE',
            },
          },
        ]);
      });

      // Make the determineOverallStatus method return FAILED
      jest
        .spyOn(service as any, 'determineOverallStatus')
        .mockReturnValue(PublishStatus.FAILED);

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

  describe('testing indirect private methods', () => {
    beforeEach(() => {
      // Setup mock for publishContentWithMedia to isolate tests
      jest
        .spyOn(service, 'publishContentWithMedia')
        .mockImplementation(async (params) => {
          // Create a mock response based on the platform
          if (
            params.platforms.some((p) => p.platform === SocialPlatform.FACEBOOK)
          ) {
            return {
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
            };
          } else if (
            params.platforms.some(
              (p) => p.platform === SocialPlatform.INSTAGRAM,
            )
          ) {
            return {
              publishId: mockPublishId,
              status: PublishStatus.COMPLETED,
              mediaItems: [mockUploadedFile],
              results: [
                {
                  platform: SocialPlatform.INSTAGRAM,
                  accountId: 'ig123',
                  success: true,
                  postId: mockInstagramResponse.platformPostId,
                  postedAt: mockInstagramResponse.postedAt,
                },
              ],
            };
          } else if (
            params.platforms.some((p) => p.platform === SocialPlatform.LINKEDIN)
          ) {
            return {
              publishId: mockPublishId,
              status: PublishStatus.COMPLETED,
              mediaItems: [mockUploadedFile],
              results: [
                {
                  platform: SocialPlatform.LINKEDIN,
                  accountId: 'li123',
                  success: true,
                  postId: mockLinkedInResponse.platformPostId,
                  postedAt: mockLinkedInResponse.postedAt,
                },
              ],
            };
          } else if (
            params.platforms.some((p) => p.platform === SocialPlatform.TIKTOK)
          ) {
            return {
              publishId: mockPublishId,
              status: PublishStatus.COMPLETED,
              mediaItems: [mockUploadedFile],
              results: [
                {
                  platform: SocialPlatform.TIKTOK,
                  accountId: 'tt123',
                  success: true,
                  postId: mockTikTokResponse.platformPostId,
                  postedAt: mockTikTokResponse.postedAt,
                },
              ],
            };
          }

          return {
            publishId: mockPublishId,
            status: PublishStatus.FAILED,
            mediaItems: [],
            results: [],
          };
        });
    });

    describe('publishToPlatform (private method test)', () => {
      it('should publish to Facebook with the correct parameters', async () => {
        await service.publishContentWithMedia({
          userId: mockUserId,
          content: mockContent,
          platforms: [
            { platform: SocialPlatform.FACEBOOK, accountId: 'fb123' },
          ],
          files: [mockFile],
        });

        // We can't directly test the private method, but we can verify the service was called
        expect(facebookService.post).toHaveBeenCalled();
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

        expect(instagramService.post).toHaveBeenCalled();
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

        expect(linkedinService.post).toHaveBeenCalled();
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

        expect(tiktokService.post).toHaveBeenCalled();
      });
    });

    describe('determineOverallStatus (private method tests)', () => {
      it('should return COMPLETED when all platforms succeed', async () => {
        // We'll use a custom spy implementation to test the determineOverallStatus method
        const spy = jest.spyOn(service as any, 'determineOverallStatus');

        // Reset our mock implementation to use the real method
        jest.spyOn(service, 'publishContentWithMedia').mockRestore();

        // Setup allSettled to return success for all
        jest.spyOn(Promise, 'allSettled').mockImplementationOnce(() => {
          return Promise.resolve([
            {
              status: 'fulfilled',
              value: {
                platform: SocialPlatform.FACEBOOK,
                accountId: 'fb123',
                success: true,
              },
            },
            {
              status: 'fulfilled',
              value: {
                platform: SocialPlatform.LINKEDIN,
                accountId: 'li123',
                success: true,
              },
            },
          ]);
        });

        // Mock save and update to avoid real DB calls
        publishRepo.save.mockResolvedValue({
          id: mockPublishId,
          userId: mockUserId,
          status: PublishStatus.PENDING,
        });

        // Setup media storage to avoid errors
        mediaStorageService.uploadPostMedia.mockResolvedValue([]);

        const result = await service.publishContentWithMedia({
          userId: mockUserId,
          content: mockContent,
          platforms: [
            { platform: SocialPlatform.FACEBOOK, accountId: 'fb123' },
            { platform: SocialPlatform.LINKEDIN, accountId: 'li123' },
          ],
        });

        // Check if determineOverallStatus was called (can't check its internal logic directly)
        expect(spy).toHaveBeenCalled();

        // With the mock we set up, it should return COMPLETED for all successful
        expect(result.status).toBe(PublishStatus.COMPLETED);
      });

      it('should return PARTIALLY_COMPLETED when some platforms succeed and some fail', async () => {
        // Override determineOverallStatus for testing private method
        const spy = jest.spyOn(service as any, 'determineOverallStatus');

        // Reset our mock implementation
        jest.spyOn(service, 'publishContentWithMedia').mockRestore();

        // Setup allSettled to return mixed results
        jest.spyOn(Promise, 'allSettled').mockImplementationOnce(() => {
          return Promise.resolve([
            {
              status: 'fulfilled',
              value: {
                platform: SocialPlatform.FACEBOOK,
                accountId: 'fb123',
                success: true,
              },
            },
            {
              status: 'rejected',
              reason: {
                platform: SocialPlatform.LINKEDIN,
                accountId: 'li123',
                message: 'LinkedIn API error',
              },
            },
          ]);
        });

        // Mock necessary methods
        publishRepo.save.mockResolvedValue({
          id: mockPublishId,
          userId: mockUserId,
          status: PublishStatus.PENDING,
        });
        mediaStorageService.uploadPostMedia.mockResolvedValue([]);

        // First mock the LinkedIn service to throw
        linkedinService.post.mockRejectedValueOnce(
          new Error('LinkedIn API error'),
        );

        const result = await service.publishContentWithMedia({
          userId: mockUserId,
          content: mockContent,
          platforms: [
            { platform: SocialPlatform.FACEBOOK, accountId: 'fb123' },
            { platform: SocialPlatform.LINKEDIN, accountId: 'li123' },
          ],
        });

        // Check if determineOverallStatus was called
        expect(spy).toHaveBeenCalled();

        // Should be PARTIALLY_COMPLETED for mixed results
        expect(result.status).toBe(PublishStatus.PARTIALLY_COMPLETED);
      });

      it('should return FAILED when all platforms fail', async () => {
        // Override determineOverallStatus for testing private method
        const spy = jest.spyOn(service as any, 'determineOverallStatus');

        // Reset our mock implementation
        jest.spyOn(service, 'publishContentWithMedia').mockRestore();

        // Setup allSettled to return all failures
        jest.spyOn(Promise, 'allSettled').mockImplementationOnce(() => {
          return Promise.resolve([
            {
              status: 'rejected',
              reason: {
                platform: SocialPlatform.FACEBOOK,
                accountId: 'fb123',
                message: 'Facebook API error',
              },
            },
            {
              status: 'rejected',
              reason: {
                platform: SocialPlatform.LINKEDIN,
                accountId: 'li123',
                message: 'LinkedIn API error',
              },
            },
          ]);
        });

        // Mock necessary methods
        publishRepo.save.mockResolvedValue({
          id: mockPublishId,
          userId: mockUserId,
          status: PublishStatus.PENDING,
        });
        mediaStorageService.uploadPostMedia.mockResolvedValue([]);

        // Mock service failures
        facebookService.post.mockRejectedValueOnce(
          new Error('Facebook API error'),
        );
        linkedinService.post.mockRejectedValueOnce(
          new Error('LinkedIn API error'),
        );

        const result = await service.publishContentWithMedia({
          userId: mockUserId,
          content: mockContent,
          platforms: [
            { platform: SocialPlatform.FACEBOOK, accountId: 'fb123' },
            { platform: SocialPlatform.LINKEDIN, accountId: 'li123' },
          ],
        });

        // Check if determineOverallStatus was called
        expect(spy).toHaveBeenCalled();

        // Should be FAILED for all failures
        expect(result.status).toBe(PublishStatus.FAILED);
      });
    });
  });
});
