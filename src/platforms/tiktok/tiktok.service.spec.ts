import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { TikTokService } from './tiktok.service';
import { TikTokRepository } from './repositories/tiktok.repository';
import { TikTokConfig } from './config/tiktok.config';
import { TenantService } from '../../user-management/tenant/tenant.service';
import { MediaStorageService } from '../../asset-management/media-storage/media-storage.service';
import { TikTokApiException } from './helpers/tiktok-api.exception';
import {
  CreateVideoParams,
  TikTokPostVideoStatus,
  TikTokVideoPrivacyLevel,
} from './helpers/tiktok.interfaces';
import { MediaItem } from '../platform-service.interface';
import { DateRange } from '../../cross-platform/helpers/cross-platform.interface';
import { PinoLogger } from 'nestjs-pino';
import { TikTokAccount } from '../entities/tiktok-entities/tiktok-account.entity';

jest.mock('axios');
jest.mock('config', () => ({
  get: jest.fn().mockImplementation((key) => {
    if (key === 'platforms.tiktok.clientKey') return 'mock_client_key';
    if (key === 'platforms.tiktok.clientSecret') return 'mock_client_secret';
    return null;
  }),
}));

describe('TikTokService', () => {
  let service: TikTokService;
  let tiktokRepo: jest.Mocked<TikTokRepository>;
  let tenantService: jest.Mocked<TenantService>;
  let mediaStorageService: jest.Mocked<MediaStorageService>;
  // let tiktokConfig: TikTokConfig;
  let mockedAxios;
  let loggerSpy;
  let logger: PinoLogger;

  // Mock data
  const mockTenantId = 'tenant123';
  const mockUserId = 'user123';
  const mockAccountId = 'account123';
  const mockVideoId = 'video123';
  const mockPublishId = 'publish123';
  const mockAccessToken = 'access_token_123';
  const mockRefreshToken = 'refresh_token_123';
  const mockUploadSessionId = 'session123';
  const mockBaseUrl = 'https://open.tiktokapis.com/v2';

  const mockAccount = {
    id: mockAccountId,
    userId: mockUserId,
    tiktokUserId: mockUserId,
    socialAccount: {
      accessToken: mockAccessToken,
      refreshToken: mockRefreshToken,
      expiresAt: new Date(),
    },
  } as unknown as TikTokAccount;

  const mockDateRange: DateRange = {
    startDate: new Date('2023-01-01').toISOString(),
    endDate: new Date('2023-01-31').toISOString(),
  };

  const mockFile = {
    fieldname: 'file',
    originalname: 'video.mp4',
    mimetype: 'video/mp4',
    buffer: Buffer.from('test'),
    size: 1024,
  } as Express.Multer.File;

  const mockMediaItem: MediaItem = {
    file: mockFile,
    url: undefined,
    description: 'Test video',
  };

  const mockMediaUrlItem: MediaItem = {
    file: undefined,
    url: 'https://example.com/video.mp4',
    description: 'Test video URL',
  };

  const mockUploadedMedia = {
    id: 'media123',
    url: 'https://cdn.example.com/video.mp4',
    mimeType: 'video/mp4',
    fileName: 'video.mp4',
    size: 1024,
  };

  const mockCreateVideoParams: CreateVideoParams = {
    title: 'Test video title',
    privacyLevel: TikTokVideoPrivacyLevel.PUBLIC_TO_EVERYONE,
    disableDuet: false,
    disableStitch: false,
    disableComment: false,
    videoCoverTimestampMs: 1000,
    brandContentToggle: false,
    brandOrganicToggle: false,
    isAigc: false,
    status: TikTokPostVideoStatus.COMPLETED,
  };

  const mockUploadSession = {
    id: mockUploadSessionId,
    accountId: mockAccountId,
    publishId: mockPublishId,
    uploadUrl: 'https://upload.tiktok.com/video',
    uploadParams: {},
    status: TikTokPostVideoStatus.PENDING,
    expiresAt: new Date(Date.now() + 7200000),
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock TikTok repository
    const mockTikTokRepo = {
      setTenantId: jest.fn(),
      getAccountById: jest.fn().mockResolvedValue(mockAccount),
      getById: jest.fn().mockResolvedValue(mockAccount),
      createComment: jest.fn().mockImplementation((comment) => comment),
      createVideo: jest.fn().mockResolvedValue({}),
      updateVideoStatus: jest.fn().mockResolvedValue({}),
      createUploadSession: jest.fn().mockResolvedValue(mockUploadSession),
      getUploadSession: jest.fn().mockResolvedValue(mockUploadSession),
      updateUploadSession: jest.fn().mockResolvedValue({}),
      deleteAccount: jest.fn().mockResolvedValue({}),
    };

    // Create mock TikTok config
    const mockTikTokConfig = {
      baseUrl: mockBaseUrl,
    };

    // Create mock tenant service
    const mockTenantService = {
      getTenantId: jest.fn().mockReturnValue(mockTenantId),
    };

    // Create mock media storage service
    const mockMediaStorageService = {
      uploadPostMedia: jest.fn().mockResolvedValue([mockUploadedMedia]),
      uploadMediaFromUrl: jest.fn().mockResolvedValue(mockUploadedMedia),
    };

    // Setup test module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TikTokService,
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
          provide: TikTokRepository,
          useValue: mockTikTokRepo,
        },
        {
          provide: TikTokConfig,
          useValue: mockTikTokConfig,
        },
        {
          provide: TenantService,
          useValue: mockTenantService,
        },
        {
          provide: MediaStorageService,
          useValue: mockMediaStorageService,
        },
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
      ],
    }).compile();

    service = module.get<TikTokService>(TikTokService);
    tiktokRepo = module.get(TikTokRepository) as jest.Mocked<TikTokRepository>;
    tenantService = module.get(TenantService) as jest.Mocked<TenantService>;
    mediaStorageService = module.get(
      MediaStorageService,
    ) as jest.Mocked<MediaStorageService>;
    // tiktokConfig = module.get(TikTokConfig);
    logger = module.get(PinoLogger);

    // Mock axios
    mockedAxios = axios as jest.Mocked<typeof axios>;

    // Mock logger
    loggerSpy = jest.spyOn(logger, 'error');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAccountsByUserId', () => {
    it('should return TikTok account for a user', async () => {
      const result = await service.getAccountsByUserId(mockUserId);

      expect(tenantService.getTenantId).toHaveBeenCalled();
      expect(tiktokRepo.setTenantId).toHaveBeenCalledWith(mockTenantId);
      expect(tiktokRepo.getAccountById).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockAccount);
    });

    it('should handle errors when fetching accounts', async () => {
      tiktokRepo.getAccountById.mockRejectedValueOnce(
        new Error('Database error'),
      );

      const result = await service.getAccountsByUserId(mockUserId);

      expect(result).toBeUndefined();
      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('getUserAccounts', () => {
    it('should throw NotFoundException when no accounts found', async () => {
      tiktokRepo.getAccountById.mockResolvedValueOnce(null);

      await expect(service.getUserAccounts(mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getVideoStatus', () => {
    it('should throw NotFoundException when account not found', async () => {
      tiktokRepo.getById.mockResolvedValueOnce(null);

      await expect(
        service.getVideoStatus(mockAccountId, mockPublishId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return video status', async () => {
      const mockResponse = {
        data: {
          error: { code: 'ok' },
          data: {
            status: 'SUCCESS',
            video_id: mockVideoId,
            share_url: 'https://tiktok.com/video123',
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await service.getVideoStatus(mockAccountId, mockPublishId);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${mockBaseUrl}/post/publish/status/fetch/`,
        expect.any(Object),
      );

      expect(result).toEqual({
        status: 'SUCCESS',
        video_id: mockVideoId,
        share_url: 'https://tiktok.com/video123',
      });
    });

    it('should throw TikTokApiException when API returns error', async () => {
      const errorResponse = {
        data: {
          error: {
            code: 'error_code',
            message: 'Something went wrong',
          },
          data: {},
        },
      };

      mockedAxios.get.mockResolvedValueOnce(errorResponse);

      await expect(
        service.getVideoStatus(mockAccountId, mockPublishId),
      ).rejects.toThrow(TikTokApiException);
    });
  });

  describe('getAccountAnalytics', () => {
    it('should throw NotFoundException when account not found', async () => {
      tiktokRepo.getById.mockResolvedValueOnce(null);

      await expect(service.getAccountAnalytics(mockAccountId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return account analytics', async () => {
      const mockResponse = {
        data: {
          data: {
            followers_count: 1000,
            following_count: 200,
            likes_count: 5000,
            video_count: 50,
            profile_views: 10000,
            engagement_rate: 0.05,
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await service.getAccountAnalytics(mockAccountId);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${mockBaseUrl}/research/user/info/`,
        expect.any(Object),
      );

      expect(result).toEqual({
        followers_count: 1000,
        following_count: 200,
        likes_count: 5000,
        video_count: 50,
        profile_views: 10000,
        engagement_rate: 0.05,
      });
    });

    it('should throw TikTokApiException when API request fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

      await expect(service.getAccountAnalytics(mockAccountId)).rejects.toThrow(
        TikTokApiException,
      );
    });
  });

  describe('getVideoPerformance', () => {
    it('should throw NotFoundException when account not found', async () => {
      tiktokRepo.getById.mockResolvedValueOnce(null);

      await expect(
        service.getVideoPerformance(mockAccountId, mockVideoId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return video performance data', async () => {
      const mockResponse = {
        data: {
          data: {
            video_views: 5000,
            total_play: 4500,
            total_share: 100,
            average_watch_time: 20.5,
            play_duration: 9000,
            reach: 4000,
            engagement: 0.08,
            video_retention: 0.7,
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await service.getVideoPerformance(
        mockAccountId,
        mockVideoId,
        7,
      );

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${mockBaseUrl}/research/video/query/`,
        expect.any(Object),
      );

      // Verify date range calculation
      const params = mockedAxios.get.mock.calls[0][1].params;
      expect(params.filters.date_range.start_date).toBeDefined();
      expect(params.filters.date_range.end_date).toBeDefined();

      expect(result).toEqual({
        video_views: 5000,
        total_play: 4500,
        total_share: 100,
        average_watch_time: 20.5,
        play_duration: 9000,
        reach: 4000,
        engagement: 0.08,
        video_retention: 0.7,
      });
    });

    it('should use default 7 days when days parameter is not provided', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { data: {} },
      });

      await service.getVideoPerformance(mockAccountId, mockVideoId);

      const params = mockedAxios.get.mock.calls[0][1].params;
      expect(params.filters.date_range).toBeDefined();

      // Current date in YYYY-MM-DD
      const today = new Date().toISOString().split('T')[0];
      expect(params.filters.date_range.end_date).toBe(today);
    });

    it('should throw TikTokApiException when API request fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

      await expect(
        service.getVideoPerformance(mockAccountId, mockVideoId),
      ).rejects.toThrow(TikTokApiException);
    });
  });

  describe('getAccountMetrics', () => {
    it('should throw NotFoundException when account not found', async () => {
      tiktokRepo.getById.mockResolvedValueOnce(null);

      await expect(
        service.getAccountMetrics(mockAccountId, mockDateRange),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return aggregated account metrics', async () => {
      const mockResponse = {
        data: {
          data: {
            follower_count: 1000,
            following_count: 200,
            likes_count: 5000,
            video_count: 50,
            profile_views: 10000,
            comment_count: 300,
            share_count: 150,
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await service.getAccountMetrics(
        mockAccountId,
        mockDateRange,
      );

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${mockBaseUrl}/user/stats/`,
        expect.objectContaining({
          params: expect.objectContaining({
            start_date: mockDateRange.startDate,
            end_date: mockDateRange.endDate,
          }),
        }),
      );

      expect(result).toEqual({
        followers: 1000,
        engagement: 5300, // likes_count + comment_count
        impressions: 10000,
        reach: 10000,
        posts: 50,
        platformSpecific: {
          followingCount: 200,
          likesCount: 5000,
          commentCount: 300,
          shareCount: 150,
        },
        dateRange: mockDateRange,
      });
    });

    it('should handle missing metrics with default values', async () => {
      const mockResponse = {
        data: {
          data: {},
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await service.getAccountMetrics(
        mockAccountId,
        mockDateRange,
      );

      expect(result).toEqual({
        followers: 0,
        engagement: 0,
        impressions: 0,
        reach: 0,
        posts: 0,
        platformSpecific: {
          followingCount: undefined,
          likesCount: undefined,
          commentCount: undefined,
          shareCount: undefined,
        },
        dateRange: mockDateRange,
      });
    });

    it('should throw TikTokApiException when API request fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

      await expect(
        service.getAccountMetrics(mockAccountId, mockDateRange),
      ).rejects.toThrow(TikTokApiException);
    });
  });

  describe('revokeAccess', () => {
    it('should throw NotFoundException when account not found', async () => {
      tiktokRepo.getById.mockResolvedValueOnce(null);

      await expect(service.revokeAccess(mockAccountId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should revoke TikTok access and delete account', async () => {
      mockedAxios.post.mockResolvedValueOnce({});

      await service.revokeAccess(mockAccountId);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${mockBaseUrl}/oauth/revoke/`,
        null,
        expect.objectContaining({
          params: {
            client_key: 'mock_client_key',
            client_secret: 'mock_client_secret',
            token: mockAccessToken,
          },
        }),
      );

      expect(tiktokRepo.deleteAccount).toHaveBeenCalledWith(mockAccountId);
    });

    it('should throw TikTokApiException when revoke fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('API error'));

      await expect(service.revokeAccess(mockAccountId)).rejects.toThrow(
        TikTokApiException,
      );
    });
  });

  describe('uploadTitTokMediaItemsToStorage (private method test)', () => {
    it('should handle file uploads correctly', async () => {
      tiktokRepo.getById.mockResolvedValueOnce(mockAccount);

      // Mock initializeVideoUpload
      jest.spyOn(service, 'initializeVideoUpload').mockResolvedValueOnce({
        publishId: mockPublishId,
        uploadUrl: 'https://upload.tiktok.com/video123',
      });

      // Mock checkUploadStatus
      jest.spyOn(service, 'checkUploadStatus').mockResolvedValueOnce('SUCCESS');

      await service.post(mockAccountId, mockCreateVideoParams, [mockMediaItem]);

      expect(mediaStorageService.uploadPostMedia).toHaveBeenCalled();
      expect(mediaStorageService.uploadMediaFromUrl).not.toHaveBeenCalled();
    });

    it('should handle URL uploads correctly', async () => {
      tiktokRepo.getById.mockResolvedValueOnce(mockAccount);

      // Mock initializeVideoUpload
      jest.spyOn(service, 'initializeVideoUpload').mockResolvedValueOnce({
        publishId: mockPublishId,
        uploadUrl: 'https://upload.tiktok.com/video123',
      });

      // Mock checkUploadStatus
      jest.spyOn(service, 'checkUploadStatus').mockResolvedValueOnce('SUCCESS');

      await service.post(mockAccountId, mockCreateVideoParams, [
        mockMediaUrlItem,
      ]);

      expect(mediaStorageService.uploadPostMedia).not.toHaveBeenCalled();
      expect(mediaStorageService.uploadMediaFromUrl).toHaveBeenCalled();
    });
  });

  describe('splitBuffer (private method test)', () => {
    it('should split buffer into chunks of specified size', () => {
      const buffer = Buffer.from('0123456789');

      // Use reflection to access private method
      const splitBuffer = service['splitBuffer'].bind(service);

      const chunks = splitBuffer(buffer, 3);

      expect(chunks).toHaveLength(4);
      expect(chunks[0].toString()).toBe('012');
      expect(chunks[1].toString()).toBe('345');
      expect(chunks[2].toString()).toBe('678');
      expect(chunks[3].toString()).toBe('9');
    });

    it('should return a single chunk when buffer is smaller than chunk size', () => {
      const buffer = Buffer.from('0123456789');

      // Use reflection to access private method
      const splitBuffer = service['splitBuffer'].bind(service);

      const chunks = splitBuffer(buffer, 20);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].toString()).toBe('0123456789');
    });
  });

  describe('getComments', () => {
    it('should throw NotFoundException when account not found', async () => {
      tiktokRepo.getById.mockResolvedValueOnce(null);

      await expect(
        service.getComments(mockAccountId, mockVideoId),
      ).rejects.toThrow(TikTokApiException);
    });

    it('should return comments for a video', async () => {
      const mockCommentsResponse = {
        data: {
          data: {
            comments: [
              {
                id: 'comment123',
                text: 'Great video!',
                create_time: 1609459200, // 2021-01-01
                user_id: 'user456',
                username: 'Jane Doe',
                likes_count: 10,
                reply_count: 2,
              },
            ],
            cursor: 'next_cursor',
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockCommentsResponse);

      const result = await service.getComments(mockAccountId, mockVideoId);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${mockBaseUrl}/video/comment/list/`,
        expect.any(Object),
      );

      expect(tiktokRepo.createComment).toHaveBeenCalledWith({
        videoId: mockVideoId,
        platformCommentId: 'comment123',
        content: 'Great video!',
        authorId: 'user456',
        authorUsername: 'Jane Doe',
        likeCount: 10,
        replyCount: 2,
        commentedAt: expect.any(Date),
      });

      expect(result).toEqual({
        items: [
          {
            videoId: mockVideoId,
            platformCommentId: 'comment123',
            content: 'Great video!',
            authorId: 'user456',
            authorUsername: 'Jane Doe',
            likeCount: 10,
            replyCount: 2,
            commentedAt: expect.any(Date),
          },
        ],
        nextPageToken: 'next_cursor',
      });
    });

    it('should pass pageToken to API when provided', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { data: { comments: [] } },
      });

      await service.getComments(mockAccountId, mockVideoId, 'cursor123');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            cursor: 'cursor123',
          }),
        }),
      );
    });

    it('should throw TikTokApiException when API request fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

      await expect(
        service.getComments(mockAccountId, mockVideoId),
      ).rejects.toThrow(TikTokApiException);
    });
  });

  describe('getPostMetrics', () => {
    it('should throw HttpException when account not found', async () => {
      tiktokRepo.getById.mockResolvedValueOnce(null);

      await expect(
        service.getPostMetrics(mockAccountId, mockVideoId),
      ).rejects.toThrow(TikTokApiException);
    });

    it('should return metrics for a video', async () => {
      const mockMetricsResponse = {
        data: {
          error: { code: 'ok' },
          data: {
            videos: [
              {
                id: mockVideoId,
                like_count: 100,
                comment_count: 20,
                share_count: 30,
                view_count: 5000,
                play_count: 4500,
                forward_count: 15,
                download_count: 10,
                average_watch_time: 45.5,
                video_completion_rate: 0.75,
              },
            ],
          },
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockMetricsResponse);

      const result = await service.getPostMetrics(mockAccountId, mockVideoId);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${mockBaseUrl}/video/query/`,
        {
          filters: {
            video_ids: [mockVideoId],
          },
        },
        expect.any(Object),
      );

      expect(result).toEqual({
        engagement: 150, // like_count + comment_count + share_count
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
      });
    });

    it('should throw TikTokApiException when API returns error code', async () => {
      const errorResponse = {
        data: {
          error: {
            code: 'error_code',
            message: 'Something went wrong',
          },
          data: {},
        },
      };

      mockedAxios.post.mockResolvedValueOnce(errorResponse);

      await expect(
        service.getPostMetrics(mockAccountId, mockVideoId),
      ).rejects.toThrow(TikTokApiException);
    });

    it('should throw TikTokApiException when API request fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('API error'));

      await expect(
        service.getPostMetrics(mockAccountId, mockVideoId),
      ).rejects.toThrow(TikTokApiException);
    });
  });

  describe('initializeVideoUpload', () => {
    it('should throw NotFoundException when account not found', async () => {
      tiktokRepo.getById.mockResolvedValueOnce(null);

      await expect(
        service.initializeVideoUpload(mockAccountId, mockCreateVideoParams, {
          source: 'PULL_FROM_URL',
          videoUrl: 'https://example.com/video.mp4',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw TikTokApiException when API returns error', async () => {
      const errorResponse = {
        data: {
          error: {
            code: 'error_code',
            message: 'Something went wrong',
          },
          data: {},
        },
      };

      mockedAxios.post.mockResolvedValueOnce(errorResponse);

      await expect(
        service.initializeVideoUpload(mockAccountId, mockCreateVideoParams, {
          source: 'PULL_FROM_URL',
          videoUrl: 'https://example.com/video.mp4',
        }),
      ).rejects.toThrow(TikTokApiException);
    });
  });

  describe('initializeFileUpload', () => {
    it('should throw NotFoundException when account not found', async () => {
      tiktokRepo.getById.mockResolvedValueOnce(null);

      await expect(
        service.initializeFileUpload(mockAccountId, 1024, 512),
      ).rejects.toThrow(NotFoundException);
    });

    it('should initialize file upload', async () => {
      const mockResponse = {
        data: {
          error: { code: 'ok' },
          data: {
            publish_id: mockPublishId,
            upload_url: 'https://upload.tiktok.com/video123',
          },
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await service.initializeFileUpload(
        mockAccountId,
        1024,
        512,
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${mockBaseUrl}/post/publish/inbox/video/init/`,
        {
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: 1024,
            chunk_size: 512,
            total_chunk_count: 2,
          },
        },
        expect.any(Object),
      );

      expect(tiktokRepo.createUploadSession).toHaveBeenCalled();
      expect(result).toEqual(mockUploadSession);
    });

    it('should throw TikTokApiException when API returns error', async () => {
      const errorResponse = {
        data: {
          error: {
            code: 'error_code',
            message: 'Something went wrong',
          },
          data: {},
        },
      };

      mockedAxios.post.mockResolvedValueOnce(errorResponse);

      await expect(
        service.initializeFileUpload(mockAccountId, 1024, 512),
      ).rejects.toThrow(TikTokApiException);
    });
  });

  describe('post', () => {
    it('should throw NotFoundException when account not found', async () => {
      tiktokRepo.getById.mockResolvedValueOnce(null);

      await expect(
        service.post(mockAccountId, mockCreateVideoParams, [mockMediaItem]),
      ).rejects.toThrow(NotFoundException);
    });

    it('should post a video using URL', async () => {
      // Mock initializeVideoUpload response
      const initializeResponse = {
        publishId: mockPublishId,
        uploadUrl: 'https://upload.tiktok.com/video123',
      };

      jest
        .spyOn(service, 'initializeVideoUpload')
        .mockResolvedValueOnce(initializeResponse);
      jest.spyOn(service, 'checkUploadStatus').mockResolvedValueOnce('SUCCESS');

      const result = await service.post(mockAccountId, mockCreateVideoParams, [
        mockMediaUrlItem,
      ]);

      expect(mediaStorageService.uploadMediaFromUrl).toHaveBeenCalled();
      expect(service.initializeVideoUpload).toHaveBeenCalledWith(
        mockAccountId,
        mockCreateVideoParams,
        {
          source: 'PULL_FROM_URL',
          videoUrl: mockUploadedMedia.url,
        },
      );
      expect(service.checkUploadStatus).toHaveBeenCalledWith(
        mockAccountId,
        mockPublishId,
      );

      expect(result).toEqual({
        platformPostId: mockPublishId,
        postedAt: expect.any(Date),
      });
    });

    it('should throw exception when upload status is FAILED', async () => {
      // Mock initializeVideoUpload response
      const initializeResponse = {
        publishId: mockPublishId,
        uploadUrl: 'https://upload.tiktok.com/video123',
      };

      jest
        .spyOn(service, 'initializeVideoUpload')
        .mockResolvedValueOnce(initializeResponse);
      jest.spyOn(service, 'checkUploadStatus').mockResolvedValueOnce('FAILED');

      await expect(
        service.post(mockAccountId, mockCreateVideoParams, [mockMediaUrlItem]),
      ).rejects.toThrow(TikTokApiException);
    });
  });

  describe('uploadLocalVideo', () => {
    it('should throw NotFoundException when account not found', async () => {
      tiktokRepo.getById.mockResolvedValueOnce(null);

      await expect(
        service.uploadLocalVideo(
          mockAccountId,
          Buffer.from('test'),
          mockCreateVideoParams,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should upload a video in chunks', async () => {
      const videoBuffer = Buffer.from('test video content');

      // Mock initializeVideoUpload response
      const initializeResponse = {
        publishId: mockPublishId,
        uploadUrl: 'https://upload.tiktok.com/video123',
      };

      jest
        .spyOn(service, 'initializeVideoUpload')
        .mockResolvedValueOnce(initializeResponse);
      jest.spyOn(service, 'checkUploadStatus').mockResolvedValueOnce('SUCCESS');

      // Mock axios.put for chunk uploads
      mockedAxios.put.mockResolvedValue({});

      const result = await service.uploadLocalVideo(
        mockAccountId,
        videoBuffer,
        mockCreateVideoParams,
      );

      expect(service.initializeVideoUpload).toHaveBeenCalledWith(
        mockAccountId,
        mockCreateVideoParams,
        {
          source: 'FILE_UPLOAD',
          videoSize: videoBuffer.length,
          chunkSize: 10 * 1024 * 1024,
          totalChunkCount: 1,
        },
      );

      // Should upload one chunk
      expect(mockedAxios.put).toHaveBeenCalledTimes(1);
      expect(mockedAxios.put).toHaveBeenCalledWith(
        'https://upload.tiktok.com/video123',
        videoBuffer,
        expect.any(Object),
      );

      expect(service.checkUploadStatus).toHaveBeenCalledWith(
        mockAccountId,
        mockPublishId,
      );

      expect(result).toEqual({
        platformPostId: mockPublishId,
        postedAt: expect.any(Date),
      });
    });

    it('should throw exception when upload URL is missing', async () => {
      // Mock initializeVideoUpload response with missing uploadUrl
      const initializeResponse = {
        publishId: mockPublishId,
        uploadUrl: null,
      };

      jest
        .spyOn(service, 'initializeVideoUpload')
        .mockResolvedValueOnce(initializeResponse);

      await expect(
        service.uploadLocalVideo(
          mockAccountId,
          Buffer.from('test'),
          mockCreateVideoParams,
        ),
      ).rejects.toThrow(TikTokApiException);
    });

    it('should throw exception when chunk upload fails', async () => {
      const videoBuffer = Buffer.from('test video content');

      // Mock initializeVideoUpload response
      const initializeResponse = {
        publishId: mockPublishId,
        uploadUrl: 'https://upload.tiktok.com/video123',
      };

      jest
        .spyOn(service, 'initializeVideoUpload')
        .mockResolvedValueOnce(initializeResponse);

      // Mock axios.put to fail
      mockedAxios.put.mockRejectedValueOnce(new Error('Upload error'));

      await expect(
        service.uploadLocalVideo(
          mockAccountId,
          videoBuffer,
          mockCreateVideoParams,
        ),
      ).rejects.toThrow(TikTokApiException);
    });
  });
});
