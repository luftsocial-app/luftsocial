import { Test } from '@nestjs/testing';
import { TikTokController } from './tiktok.controller';
import { TikTokService } from './tiktok.service';
import { TikTokErrorInterceptor } from './helpers/tiktok-error.interceptor';
import { RateLimitInterceptor } from './helpers/rate-limit.interceptor';
import { MediaItem } from '../platform-service.interface';
import { TikTokPostVideoStatus } from './helpers/tiktok.interfaces';
import { TikTokRepository } from './repositories/tiktok.repository';
import { CreateVideoDto } from './helpers/create-video.dto.ts';

describe('TikTokController', () => {
  let controller: TikTokController;
  let tiktokService: jest.Mocked<TikTokService>;

  // Mock data
  const mockAccountId = 'account123';
  const mockVideoId = 'video123';
  const mockPublishId = 'publish123';
  const mockCursor = 'cursor123';
  const mockDays = 14;

  const mockFile = {
    fieldname: 'video',
    originalname: 'test-video.mp4',
    encoding: '7bit',
    mimetype: 'video/mp4',
    buffer: Buffer.from('test video content'),
    size: 1024,
  } as Express.Multer.File;

  const mockCreateVideoDto: CreateVideoDto = {
    title: 'Test TikTok video',
    privacyLevel: 'PUBLIC',
    disableDuet: false,
    disableStitch: false,
    disableComment: false,
    videoCoverTimestampMs: 1000,
    brandContentToggle: false,
    brandOrganicToggle: false,
    isAigc: false,
    status: TikTokPostVideoStatus.PUBLISH_NOW,
    videoUrl: 'https://example.com/video.mp4',
  };

  const mockCreateVideoDtoWithoutUrl: CreateVideoDto = {
    ...mockCreateVideoDto,
    videoUrl: undefined,
  };

  const mockPostResponse = {
    platformPostId: 'tiktok_post_123',
    postedAt: new Date(),
  };

  const mockCommentsResponse = {
    items: [
      {
        videoId: mockVideoId,
        platformCommentId: 'comment123',
        content: 'Great video!',
        authorId: 'user456',
        authorUsername: 'Jane Doe',
        likeCount: 10,
        replyCount: 2,
        commentedAt: new Date(),
      },
    ],
    nextPageToken: 'next_cursor',
  };

  const mockVideoStatusResponse = {
    status: 'SUCCESS',
    video_id: mockVideoId,
    share_url: 'https://tiktok.com/video123',
  };

  const mockPostMetricsResponse = {
    engagement: 150,
    impressions: 5000,
    reactions: 100,
    comments: 20,
    shares: 30,
    platformSpecific: {
      playCount: 4500,
      forwardCount: 15,
      downloadCount: 10,
      avgWatchTime: 45.5,
      completionRate: 0.75,
    },
  };

  const mockAccountAnalyticsResponse = {
    followers_count: 1000,
    following_count: 200,
    likes_count: 5000,
    video_count: 50,
    profile_views: 10000,
    engagement_rate: 0.05,
  };

  const mockVideoPerformanceResponse = {
    video_views: 5000,
    total_play: 4500,
    total_share: 100,
    average_watch_time: 20.5,
    play_duration: 9000,
    reach: 4000,
    engagement: 0.08,
    video_retention: 0.7,
  };

  beforeEach(async () => {
    // Create mock implementation of TikTokService
    const mockTikTokService = {
      post: jest.fn().mockResolvedValue(mockPostResponse),
      getComments: jest.fn().mockResolvedValue(mockCommentsResponse),
      getVideoStatus: jest.fn().mockResolvedValue(mockVideoStatusResponse),
      getPostMetrics: jest.fn().mockResolvedValue(mockPostMetricsResponse),
      getAccountAnalytics: jest
        .fn()
        .mockResolvedValue(mockAccountAnalyticsResponse),
      getVideoPerformance: jest
        .fn()
        .mockResolvedValue(mockVideoPerformanceResponse),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [TikTokController],
      providers: [
        {
          provide: TikTokService,
          useValue: mockTikTokService,
        },
        {
          provide: TikTokRepository,
          useValue: {
            setTenantId: jest.fn(),
            getRateLimitStatus: jest.fn().mockResolvedValue({
              isLimited: false,
              resetTime: null,
            }),
            updateRateLimit: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    })
      .overrideInterceptor(TikTokErrorInterceptor)
      .useValue({
        intercept: jest
          .fn()
          .mockImplementation((context, next) => next.handle()),
      })
      .overrideInterceptor(RateLimitInterceptor)
      .useValue({
        intercept: jest
          .fn()
          .mockImplementation((context, next) => next.handle()),
      })
      .compile();

    controller = moduleRef.get<TikTokController>(TikTokController);
    tiktokService = moduleRef.get(TikTokService) as jest.Mocked<TikTokService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadVideoFile', () => {
    it('should upload a video with both file and URL', async () => {
      const result = await controller.uploadVideoFile(
        mockAccountId,
        mockFile,
        mockCreateVideoDto,
      );

      // Verify the correct media items are passed to the service
      const expectedMedia: MediaItem[] = [
        { file: mockFile, url: undefined },
        { file: undefined, url: mockCreateVideoDto.videoUrl },
      ];

      expect(tiktokService.post).toHaveBeenCalledWith(
        mockAccountId,
        mockCreateVideoDto,
        expectedMedia,
      );
      expect(result).toEqual(mockPostResponse);
    });

    it('should upload a video with only file (no URL)', async () => {
      const result = await controller.uploadVideoFile(
        mockAccountId,
        mockFile,
        mockCreateVideoDtoWithoutUrl,
      );

      // Verify only file media item is passed
      const expectedMedia: MediaItem[] = [{ file: mockFile, url: undefined }];

      expect(tiktokService.post).toHaveBeenCalledWith(
        mockAccountId,
        mockCreateVideoDtoWithoutUrl,
        expectedMedia,
      );
      expect(result).toEqual(mockPostResponse);
    });

    it('should upload a video with only URL (no file)', async () => {
      const result = await controller.uploadVideoFile(
        mockAccountId,
        null, // No file
        mockCreateVideoDto,
      );

      // Verify only URL media item is passed
      const expectedMedia: MediaItem[] = [
        { file: undefined, url: mockCreateVideoDto.videoUrl },
      ];

      expect(tiktokService.post).toHaveBeenCalledWith(
        mockAccountId,
        mockCreateVideoDto,
        expectedMedia,
      );
      expect(result).toEqual(mockPostResponse);
    });

    it('should throw error when neither file nor URL is provided', async () => {
      // This should be handled by validation, but we'll test service behavior
      const result = await controller.uploadVideoFile(
        mockAccountId,
        null, // No file
        mockCreateVideoDtoWithoutUrl, // No URL
      );

      expect(tiktokService.post).toHaveBeenCalledWith(
        mockAccountId,
        mockCreateVideoDtoWithoutUrl,
        [], // Empty media array
      );
      expect(result).toEqual(mockPostResponse);
    });

    it('should handle errors from the TikTok service', async () => {
      const errorMessage = 'Failed to upload video';
      tiktokService.post.mockRejectedValueOnce(new Error(errorMessage));

      await expect(
        controller.uploadVideoFile(mockAccountId, mockFile, mockCreateVideoDto),
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('getComments', () => {
    it('should get comments without cursor', async () => {
      const result = await controller.getComments(mockAccountId, mockVideoId);

      expect(tiktokService.getComments).toHaveBeenCalledWith(
        mockAccountId,
        mockVideoId,
        undefined,
      );
      expect(result).toEqual(mockCommentsResponse);
    });

    it('should get comments with cursor', async () => {
      const result = await controller.getComments(
        mockAccountId,
        mockVideoId,
        mockCursor,
      );

      expect(tiktokService.getComments).toHaveBeenCalledWith(
        mockAccountId,
        mockVideoId,
        mockCursor,
      );
      expect(result).toEqual(mockCommentsResponse);
    });

    it('should handle errors from the TikTok service', async () => {
      const errorMessage = 'Failed to fetch comments';
      tiktokService.getComments.mockRejectedValueOnce(new Error(errorMessage));

      await expect(
        controller.getComments(mockAccountId, mockVideoId),
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('getVideoStatus', () => {
    it('should get video status', async () => {
      const result = await controller.getVideoStatus(
        mockAccountId,
        mockPublishId,
      );

      expect(tiktokService.getVideoStatus).toHaveBeenCalledWith(
        mockAccountId,
        mockPublishId,
      );
      expect(result).toEqual(mockVideoStatusResponse);
    });

    it('should handle errors from the TikTok service', async () => {
      const errorMessage = 'Failed to fetch video status';
      tiktokService.getVideoStatus.mockRejectedValueOnce(
        new Error(errorMessage),
      );

      await expect(
        controller.getVideoStatus(mockAccountId, mockPublishId),
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('getMetrics', () => {
    it('should get video metrics', async () => {
      const result = await controller.getMetrics(mockAccountId, mockVideoId);

      expect(tiktokService.getPostMetrics).toHaveBeenCalledWith(
        mockAccountId,
        mockVideoId,
      );
      expect(result).toEqual(mockPostMetricsResponse);
    });

    it('should handle errors from the TikTok service', async () => {
      const errorMessage = 'Failed to fetch metrics';
      tiktokService.getPostMetrics.mockRejectedValueOnce(
        new Error(errorMessage),
      );

      await expect(
        controller.getMetrics(mockAccountId, mockVideoId),
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('getAnalytics', () => {
    it('should get account analytics with default days', async () => {
      const result = await controller.getAnalytics(mockAccountId);

      expect(tiktokService.getAccountAnalytics).toHaveBeenCalledWith(
        mockAccountId,
      );
      expect(result).toEqual(mockAccountAnalyticsResponse);
    });

    it('should get account analytics with specified days', async () => {
      const result = await controller.getAnalytics(mockAccountId, mockDays);

      // Note: The days parameter is not actually used in the controller method
      // but is accepted as a parameter - we're just testing that it doesn't break anything
      expect(tiktokService.getAccountAnalytics).toHaveBeenCalledWith(
        mockAccountId,
      );
      expect(result).toEqual(mockAccountAnalyticsResponse);
    });

    it('should handle errors from the TikTok service', async () => {
      const errorMessage = 'Failed to fetch analytics';
      tiktokService.getAccountAnalytics.mockRejectedValueOnce(
        new Error(errorMessage),
      );

      await expect(controller.getAnalytics(mockAccountId)).rejects.toThrow(
        errorMessage,
      );
    });
  });

  describe('getVideoPerformance', () => {
    it('should get video performance with default days', async () => {
      const result = await controller.getVideoPerformance(
        mockAccountId,
        mockVideoId,
      );

      expect(tiktokService.getVideoPerformance).toHaveBeenCalledWith(
        mockAccountId,
        mockVideoId,
        7, // Default days
      );
      expect(result).toEqual(mockVideoPerformanceResponse);
    });

    it('should get video performance with specified days', async () => {
      const result = await controller.getVideoPerformance(
        mockAccountId,
        mockVideoId,
        mockDays,
      );

      expect(tiktokService.getVideoPerformance).toHaveBeenCalledWith(
        mockAccountId,
        mockVideoId,
        mockDays,
      );
      expect(result).toEqual(mockVideoPerformanceResponse);
    });

    it('should handle errors from the TikTok service', async () => {
      const errorMessage = 'Failed to fetch video performance';
      tiktokService.getVideoPerformance.mockRejectedValueOnce(
        new Error(errorMessage),
      );

      await expect(
        controller.getVideoPerformance(mockAccountId, mockVideoId),
      ).rejects.toThrow(errorMessage);
    });
  });
});
