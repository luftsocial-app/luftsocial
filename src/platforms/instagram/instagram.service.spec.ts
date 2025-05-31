import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { InstagramService } from './instagram.service';
import { InstagramRepository } from './repositories/instagram.repository';
import { MediaStorageService } from '../../asset-management/media-storage/media-storage.service';
import { InstagramApiException } from './helpers/instagram-api.exception';
import { CreateStoryDto } from './helpers/create-content.dto';
import { MediaType } from '../../common/enums/media-type.enum';
import { PinoLogger } from 'nestjs-pino';
import { TenantService } from '../../user-management/tenant.service';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock config
jest.mock('config', () => ({
  get: jest.fn((key) => {
    const config = {
      'platforms.instagram.clientId': 'test-client-id',
      'platforms.instagram.clientSecret': 'test-client-secret',
    };
    return config[key];
  }),
}));

describe('InstagramService', () => {
  let service: InstagramService;
  let instagramRepo: jest.Mocked<InstagramRepository>;
  let mediaStorageService: jest.Mocked<MediaStorageService>;
  let tenantService: jest.Mocked<TenantService>;
  let logger: PinoLogger;

  const mockTenantId = 'test-tenant-id';
  const mockAccountId = 'test-account-id';
  const mockAccessToken = 'test-access-token';
  const mockRefreshToken = 'test-refresh-token';
  const mockIgBusinessAccountId = 'test-ig-business-id';
  const mockMediaContainerId = 'test-media-container-id';
  const mockMediaUrl = 'https://example.com/image.jpg';

  const mockInstagramAccount = {
    id: mockAccountId,
    instagramId: mockIgBusinessAccountId,
    instagramAccountId: mockIgBusinessAccountId,
    username: 'test_instagram',
    name: 'Test Instagram Account',
    userId: 'user-123',
    accountType: 'business',
    isBusinessLogin: false,
    facebookPageAccessToken: mockAccessToken,
    facebookPageId: 'test-page-id',
    profilePictureUrl: 'https://example.com/profile.jpg',
    followerCount: 1000,
    metadata: {
      instagramAccounts: [
        {
          id: mockIgBusinessAccountId,
          username: 'test_instagram',
          pageId: 'test-page-id',
        },
      ],
    },
    socialAccount: {
      id: 'social-account-id',
      accessToken: mockAccessToken,
      refreshToken: mockRefreshToken,
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    },
  };

  const mockBusinessLoginAccount = {
    ...mockInstagramAccount,
    isBusinessLogin: true,
    facebookPageAccessToken: null,
  };

  beforeEach(async () => {
    // Create mock implementations
    const mockInstagramRepo = {
      setTenantId: jest.fn(),
      getAccountByUserId: jest.fn(),
      checkRateLimit: jest.fn(),
      recordRateLimitUsage: jest.fn(),
      createPost: jest.fn(),
      deleteAccount: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key) => {
        const config = {
          INSTAGRAM_CLIENT_KEY: 'test-client-key',
          INSTAGRAM_CLIENT_SECRET: 'test-client-secret',
        };
        return config[key];
      }),
    };

    const mockMediaStorageService = {
      uploadPostMedia: jest.fn(),
      uploadMediaFromUrl: jest.fn(),
    };

    const mockTenantService = {
      getTenantId: jest.fn().mockReturnValue(mockTenantId),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramService,
        { provide: InstagramRepository, useValue: mockInstagramRepo },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MediaStorageService, useValue: mockMediaStorageService },
        { provide: TenantService, useValue: mockTenantService },
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

    service = module.get<InstagramService>(InstagramService);
    instagramRepo = module.get(
      InstagramRepository,
    ) as jest.Mocked<InstagramRepository>;
    mediaStorageService = module.get(
      MediaStorageService,
    ) as jest.Mocked<MediaStorageService>;
    tenantService = module.get(TenantService) as jest.Mocked<TenantService>;
    logger = module.get<PinoLogger>(PinoLogger);

    // Mock Logger to avoid console outputs during tests
    jest.spyOn(logger, 'error');
    jest.spyOn(logger, 'info');
    jest.spyOn(logger, 'warn');

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('withRateLimit', () => {
    it('should execute callback if rate limit not exceeded', async () => {
      const accountId = 'account-123';
      const action = 'API_CALLS';
      const mockCallback = jest.fn().mockResolvedValue('result');

      instagramRepo.checkRateLimit.mockResolvedValue(true);

      const result = await service.withRateLimit(
        accountId,
        action,
        mockCallback,
      );

      expect(instagramRepo.checkRateLimit).toHaveBeenCalledWith(
        accountId,
        action,
      );
      expect(mockCallback).toHaveBeenCalled();
      expect(instagramRepo.recordRateLimitUsage).toHaveBeenCalledWith(
        accountId,
        action,
      );
      expect(result).toBe('result');
    });

    it('should throw HttpException if rate limit exceeded', async () => {
      const accountId = 'account-123';
      const action = 'API_CALLS';
      const mockCallback = jest.fn();

      instagramRepo.checkRateLimit.mockResolvedValue(false);

      await expect(
        service.withRateLimit(accountId, action, mockCallback),
      ).rejects.toThrow(
        new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS),
      );

      expect(instagramRepo.checkRateLimit).toHaveBeenCalledWith(
        accountId,
        action,
      );
      expect(mockCallback).not.toHaveBeenCalled();
      expect(instagramRepo.recordRateLimitUsage).not.toHaveBeenCalled();
    });

    it('should propagate errors from callback', async () => {
      const accountId = 'account-123';
      const action = 'API_CALLS';
      const testError = new Error('Test error');
      const mockCallback = jest.fn().mockRejectedValue(testError);

      instagramRepo.checkRateLimit.mockResolvedValue(true);

      await expect(
        service.withRateLimit(accountId, action, mockCallback),
      ).rejects.toThrow(testError);

      expect(instagramRepo.checkRateLimit).toHaveBeenCalledWith(
        accountId,
        action,
      );
      expect(mockCallback).toHaveBeenCalled();
      expect(instagramRepo.recordRateLimitUsage).not.toHaveBeenCalled();
    });
  });

  describe('getAccountsByUserId', () => {
    it('should return Instagram account for a user', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockInstagramAccount as any,
      );

      const result = await service.getAccountsByUserId(mockAccountId);

      expect(instagramRepo.getAccountByUserId).toHaveBeenCalledWith(
        mockAccountId,
      );
      expect(result).toBe(mockInstagramAccount);
    });

    it('should handle errors when fetching account', async () => {
      const error = new Error('Database error');
      instagramRepo.getAccountByUserId.mockRejectedValue(error);

      await expect(service.getAccountsByUserId(mockAccountId)).rejects.toThrow(
        error,
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getUserAccounts', () => {
    it('should return formatted user account details', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockInstagramAccount as any,
      );

      const result = await service.getUserAccounts('user-123');

      expect(result).toEqual({
        id: mockAccountId,
        name: 'test_instagram',
        type: 'business',
        avatarUrl: 'https://example.com/profile.jpg',
        platformSpecific: {
          accountType: 'business',
          isBusinessLogin: false,
          instagramId: mockIgBusinessAccountId,
          facebookPageId: 'test-page-id',
        },
      });
    });

    it('should throw NotFoundException when no account found', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(null);

      await expect(service.getUserAccounts('user-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAccountInsights', () => {
    it('should retrieve account insights', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockInstagramAccount as any,
      );

      const mockInsightsResponse = {
        data: {
          data: [
            { name: 'follower_count', values: [{ value: 5000 }] },
            { name: 'impressions', values: [{ value: 25000 }] },
            { name: 'profile_views', values: [{ value: 1500 }] },
            { name: 'reach', values: [{ value: 20000 }] },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockInsightsResponse);

      const result = await service.getAccountInsights(mockAccountId);

      expect(instagramRepo.getAccountByUserId).toHaveBeenCalledWith(
        mockAccountId,
      );

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockIgBusinessAccountId}/insights`),
        expect.objectContaining({
          params: expect.objectContaining({
            access_token: mockAccessToken,
            metric: expect.stringContaining(
              'follower_count,impressions,profile_views,reach',
            ),
            period: 'day',
          }),
        }),
      );

      expect(result.followerCount).toBe(5000);
      expect(result.impressions).toBe(25000);
      expect(result.profileViews).toBe(1500);
      expect(result.reach).toBe(20000);
    });

    it('should return zero for missing insights', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockInstagramAccount as any,
      );

      // Only provide some insights
      const mockInsightsResponse = {
        data: {
          data: [{ name: 'follower_count', values: [{ value: 5000 }] }],
        },
      };

      mockedAxios.get.mockResolvedValue(mockInsightsResponse);

      const result = await service.getAccountInsights(mockAccountId);

      expect(result.followerCount).toBe(5000);
      expect(result.impressions).toBe(0);
      expect(result.profileViews).toBe(0);
      expect(result.reach).toBe(0);
    });

    it('should throw HttpException if account not found', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(null);

      await expect(service.getAccountInsights(mockAccountId)).rejects.toThrow(
        InstagramApiException,
      );

      expect(instagramRepo.getAccountByUserId).toHaveBeenCalledWith(
        mockAccountId,
      );
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should throw InstagramApiException if API request fails', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockInstagramAccount as any,
      );

      const apiError = new Error('API Error');
      mockedAxios.get.mockRejectedValue(apiError);

      await expect(service.getAccountInsights(mockAccountId)).rejects.toThrow(
        InstagramApiException,
      );

      expect(instagramRepo.getAccountByUserId).toHaveBeenCalledWith(
        mockAccountId,
      );
      expect(mockedAxios.get).toHaveBeenCalled();
    });
  });

  describe('post', () => {
    const mockMediaItems = [
      { id: 'media-1', url: 'https://example.com/media1.jpg' },
    ];

    const mockContent = {
      caption: 'Test post',
      hashtags: ['test', 'instagram'],
      mentions: ['testuser'],
    };

    beforeEach(() => {
      // Mock media upload
      mediaStorageService.uploadPostMedia.mockResolvedValue(
        mockMediaItems as any,
      );

      // Mock media validation
      mockedAxios.head.mockResolvedValue({
        headers: {
          'content-type': 'image/jpeg',
          'content-length': '1000000',
        },
      });

      // Mock media container creation
      mockedAxios.post.mockImplementation((url) => {
        if (url.includes('/media')) {
          return Promise.resolve({ data: { id: mockMediaContainerId } });
        }
        if (url.includes('/media_publish')) {
          return Promise.resolve({ data: { id: 'published-post-123' } });
        }
        return Promise.resolve({ data: {} });
      });

      // Mock media status check
      mockedAxios.get.mockResolvedValue({ data: { status_code: 'FINISHED' } });
    });

    it('should create a post successfully', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockInstagramAccount as any,
      );
      instagramRepo.createPost.mockResolvedValue(undefined);

      const result = await service.post(mockAccountId, mockContent, [
        { file: Buffer.from('test image') },
      ]);

      expect(instagramRepo.getAccountByUserId).toHaveBeenCalledWith(
        mockAccountId,
      );

      expect(mediaStorageService.uploadPostMedia).toHaveBeenCalled();
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/media'),
        expect.any(URLSearchParams),
        expect.any(Object),
      );

      expect(result).toEqual({
        platformPostId: 'test-media-container-id',
        postedAt: expect.any(Date),
      });
    });

    it('should handle business login accounts', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockBusinessLoginAccount as any,
      );
      instagramRepo.createPost.mockResolvedValue(undefined);

      await service.post(mockAccountId, mockContent, [
        { file: Buffer.from('test image') },
      ]);

      // Should use Instagram Graph URL for business login
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('graph.instagram.com'),
        expect.any(URLSearchParams),
        expect.any(Object),
      );
    });

    it('should throw error when no media items provided', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockInstagramAccount as any,
      );

      await expect(
        service.post(mockAccountId, mockContent, []),
      ).rejects.toThrow(
        new HttpException(
          'Failed to create Instagram post',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should handle database save errors gracefully', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockInstagramAccount as any,
      );
      instagramRepo.createPost.mockRejectedValue(new Error('DB Error'));

      const result = await service.post(mockAccountId, mockContent, [
        { file: Buffer.from('test image') },
      ]);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to save post to database, but post was published successfully',
        expect.any(Object),
      );

      expect(result).toEqual({
        platformPostId: 'test-media-container-id',
        postedAt: expect.any(Date),
      });
    });

    it('should throw error when account not found', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(null);

      await expect(
        service.post(mockAccountId, mockContent, [
          { file: Buffer.from('test') },
        ]),
      ).rejects.toThrow(
        new HttpException(
          'Failed to create Instagram post',
          HttpStatus.NOT_FOUND,
        ),
      );
    });
  });

  describe('createStory', () => {
    const mockStickers = [
      {
        poll: {
          question: 'Do you like this?',
          options: ['Yes', 'No'],
        },
      },
    ] as unknown as CreateStoryDto['stickers'];

    beforeEach(() => {
      // Mock media validation
      mockedAxios.head.mockResolvedValue({
        headers: {
          'content-type': 'image/jpeg',
          'content-length': '1000',
        },
      });

      // Mock API responses
      mockedAxios.post.mockImplementation((url) => {
        if (url.includes('/media')) {
          return Promise.resolve({ data: { id: mockMediaContainerId } });
        }
        if (url.includes('/media_publish')) {
          return Promise.resolve({ data: { id: 'story-123' } });
        }
        return Promise.resolve({ data: {} });
      });

      // Mock media status check
      mockedAxios.get.mockResolvedValue({ data: { status_code: 'FINISHED' } });
    });

    it('should create an Instagram story', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockInstagramAccount as any,
      );

      const result = await service.createStory(
        mockAccountId,
        mockMediaUrl,
        mockStickers,
      );

      expect(instagramRepo.getAccountByUserId).toHaveBeenCalledWith(
        mockAccountId,
      );

      // Verify media container creation
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/media'),
        expect.any(URLSearchParams),
        expect.any(Object),
      );

      // Verify story publishing
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/media_publish'),
        null,
        expect.objectContaining({
          params: expect.objectContaining({
            media_id: mockMediaContainerId,
            stickers: JSON.stringify(mockStickers),
            access_token: mockAccessToken,
          }),
        }),
      );

      expect(result).toEqual({
        platformPostId: 'test-media-container-id',
        postedAt: expect.any(Date),
      });
    });

    it('should throw HttpException if account not found', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(null);

      await expect(
        service.createStory(mockAccountId, mockMediaUrl),
      ).rejects.toThrow(
        new HttpException(
          'Failed to create Instagram story',
          HttpStatus.NOT_FOUND,
        ),
      );

      expect(instagramRepo.getAccountByUserId).toHaveBeenCalledWith(
        mockAccountId,
      );
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should create story without stickers when not provided', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockInstagramAccount as any,
      );

      await service.createStory(mockAccountId, mockMediaUrl);

      // Verify story publishing without stickers
      const publishCall = mockedAxios.post.mock.calls.find((call) =>
        call[0].includes('/media_publish'),
      );

      expect(publishCall[2].params.stickers).toBeUndefined();
    });

    it('should throw InstagramApiException if API request fails', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockInstagramAccount as any,
      );

      const apiError = new Error('API Error');
      mockedAxios.post.mockRejectedValue(apiError);

      await expect(
        service.createStory(mockAccountId, mockMediaUrl),
      ).rejects.toThrow(InstagramApiException);

      expect(instagramRepo.getAccountByUserId).toHaveBeenCalledWith(
        mockAccountId,
      );
      expect(mockedAxios.post).toHaveBeenCalled();
    });
  });

  describe('getComments', () => {
    it('should fetch post comments successfully', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockInstagramAccount as any,
      );

      const mockCommentsResponse = {
        data: {
          data: [
            {
              id: 'comment-1',
              text: 'Great post!',
              timestamp: '2023-01-01T12:00:00Z',
              from: { id: 'user1', username: 'testuser' },
            },
          ],
          paging: {
            cursors: { after: 'next-page-token' },
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockCommentsResponse);

      const result = await service.getComments(mockAccountId, 'post-123');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/post-123/comments'),
        expect.objectContaining({
          params: expect.objectContaining({
            access_token: mockAccessToken,
            fields: 'id,text,timestamp,username,from',
          }),
        }),
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 'comment-1',
        content: 'Great post!',
        authorId: 'user1',
        authorName: 'testuser',
        createdAt: new Date('2023-01-01T12:00:00Z'),
      });
      expect(result.nextPageToken).toBe('next-page-token');
    });
  });

  describe('getPostMetrics', () => {
    it('should fetch post metrics successfully', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockInstagramAccount as any,
      );

      const mockMetricsResponse = {
        data: {
          data: [
            { name: 'engagement', values: [{ value: 100 }] },
            { name: 'impressions', values: [{ value: 1000 }] },
            { name: 'reach', values: [{ value: 800 }] },
            { name: 'likes', values: [{ value: 50 }] },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockMetricsResponse);

      const result = await service.getPostMetrics(mockAccountId, 'post-123');

      expect(result).toEqual({
        engagement: 100,
        impressions: 1000,
        reach: 800,
        reactions: 50,
        comments: 0,
        shares: 0,
        saves: 0,
        platformSpecific: {
          saved: 0,
          storyReplies: 0,
          storyTaps: 0,
          storyExits: 0,
        },
      });
    });
  });

  describe('getAccountMetrics', () => {
    it('should fetch account metrics successfully', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockInstagramAccount as any,
      );

      const mockMetricsResponse = {
        data: {
          data: [
            { name: 'impressions', values: [{ value: 5000 }] },
            { name: 'reach', values: [{ value: 4000 }] },
            { name: 'profile_views', values: [{ value: 300 }] },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockMetricsResponse);

      const dateRange = {
        startDate: '2023-01-01',
        endDate: '2023-01-31',
      };

      const result = await service.getAccountMetrics(mockAccountId, dateRange);

      expect(result).toEqual({
        followers: 1000,
        engagement: 300,
        impressions: 5000,
        reach: 4000,
        platformSpecific: {
          profileViews: 300,
          emailContacts: undefined,
          getDirectionsClicks: undefined,
          phoneCallClicks: undefined,
          textMessageClicks: undefined,
          websiteClicks: undefined,
        },
        dateRange,
      });
    });
  });

  describe('revokeAccess', () => {
    it('should revoke access for Facebook login account', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockInstagramAccount as any,
      );
      mockedAxios.delete.mockResolvedValue({ data: { success: true } });
      instagramRepo.deleteAccount.mockResolvedValue(undefined);

      await service.revokeAccess(mockAccountId);

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        expect.stringContaining('/me/permissions'),
        expect.objectContaining({
          params: { access_token: mockAccessToken },
        }),
      );
      expect(instagramRepo.deleteAccount).toHaveBeenCalledWith(mockAccountId);
    });

    it('should revoke access for business login account', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockBusinessLoginAccount as any,
      );
      mockedAxios.post.mockResolvedValue({ data: { success: true } });
      instagramRepo.deleteAccount.mockResolvedValue(undefined);

      await service.revokeAccess(mockAccountId);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/oauth/revoke'),
        null,
        expect.objectContaining({
          params: expect.objectContaining({
            token: mockAccessToken,
          }),
        }),
      );
      expect(instagramRepo.deleteAccount).toHaveBeenCalledWith(mockAccountId);
    });

    it('should throw NotFoundException if account not found', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(null);

      await expect(service.revokeAccess(mockAccountId)).rejects.toThrow(
        NotFoundException,
      );

      expect(instagramRepo.getAccountByUserId).toHaveBeenCalledWith(
        mockAccountId,
      );
      expect(mockedAxios.post).not.toHaveBeenCalled();
      expect(instagramRepo.deleteAccount).not.toHaveBeenCalled();
    });

    it('should throw InstagramApiException if API request fails', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockInstagramAccount as any,
      );

      const apiError = new Error('API Error');
      mockedAxios.delete.mockRejectedValue(apiError);

      await expect(service.revokeAccess(mockAccountId)).rejects.toThrow(
        InstagramApiException,
      );

      expect(instagramRepo.getAccountByUserId).toHaveBeenCalledWith(
        mockAccountId,
      );
      expect(mockedAxios.delete).toHaveBeenCalled();
      expect(instagramRepo.deleteAccount).not.toHaveBeenCalled();
    });
  });

  // Testing private methods
  describe('uploadInstagramMediaItems', () => {
    it('should upload file-based media items', async () => {
      const mediaItems = [
        { file: Buffer.from('test image 1') },
        { file: Buffer.from('test image 2') },
      ];

      const uploadedMedia1 = [
        { id: 'media-1', url: 'https://example.com/media1.jpg' },
      ];
      const uploadedMedia2 = [
        { id: 'media-2', url: 'https://example.com/media2.jpg' },
      ];

      mediaStorageService.uploadPostMedia
        .mockResolvedValueOnce(uploadedMedia1 as any)
        .mockResolvedValueOnce(uploadedMedia2 as any);

      const result = await (service as any).uploadInstagramMediaItems(
        mediaItems,
        mockAccountId,
        'post',
      );

      expect(mediaStorageService.uploadPostMedia).toHaveBeenCalledTimes(2);
      expect(result).toEqual([...uploadedMedia1, ...uploadedMedia2]);
    });

    it('should upload URL-based media items', async () => {
      const mediaItems = [{ url: 'https://example.com/source1.jpg' }];

      const uploadedMedia = {
        id: 'media-1',
        url: 'https://example.com/stored1.jpg',
      };

      mediaStorageService.uploadMediaFromUrl.mockResolvedValue(
        uploadedMedia as any,
      );

      const result = await (service as any).uploadInstagramMediaItems(
        mediaItems,
        mockAccountId,
        'scheduled',
      );

      expect(mediaStorageService.uploadMediaFromUrl).toHaveBeenCalledWith(
        mockAccountId,
        'https://example.com/source1.jpg',
        expect.stringContaining('instagram-scheduled-'),
      );

      expect(result).toEqual([uploadedMedia]);
    });

    it('should handle mixed file and URL media items', async () => {
      const mediaItems = [
        { file: Buffer.from('test image') },
        { url: 'https://example.com/source.jpg' },
      ];

      const uploadedFileMedia = [
        { id: 'media-1', url: 'https://example.com/stored1.jpg' },
      ];
      const uploadedUrlMedia = {
        id: 'media-2',
        url: 'https://example.com/stored2.jpg',
      };

      mediaStorageService.uploadPostMedia.mockResolvedValue(
        uploadedFileMedia as any,
      );
      mediaStorageService.uploadMediaFromUrl.mockResolvedValue(
        uploadedUrlMedia as any,
      );

      const result = await (service as any).uploadInstagramMediaItems(
        mediaItems,
        mockAccountId,
        'post',
      );

      expect(mediaStorageService.uploadPostMedia).toHaveBeenCalledWith(
        mockAccountId,
        [mediaItems[0].file],
        expect.stringContaining('instagram-post-'),
      );

      expect(mediaStorageService.uploadMediaFromUrl).toHaveBeenCalledWith(
        mockAccountId,
        'https://example.com/source.jpg',
        expect.stringContaining('instagram-post-'),
      );

      expect(result).toEqual([...uploadedFileMedia, uploadedUrlMedia]);
    });

    it('should return empty array if no media items provided', async () => {
      const result = await (service as any).uploadInstagramMediaItems(
        null,
        mockAccountId,
        'post',
      );

      expect(result).toEqual([]);
      expect(mediaStorageService.uploadPostMedia).not.toHaveBeenCalled();
      expect(mediaStorageService.uploadMediaFromUrl).not.toHaveBeenCalled();
    });
  });

  describe('downloadAndValidateMedia', () => {
    it('should validate and identify image media', async () => {
      mockedAxios.head.mockResolvedValue({
        headers: {
          'content-type': 'image/jpeg',
          'content-length': '1000000', // 1MB
        },
      });

      const result = await (service as any).downloadAndValidateMedia(
        mockMediaUrl,
      );

      expect(mockedAxios.head).toHaveBeenCalledWith(mockMediaUrl, {
        timeout: 10000,
      });
      expect(result).toEqual({
        type: MediaType.IMAGE,
        mimeType: 'image/jpeg',
      });
    });

    it('should validate and identify video media', async () => {
      mockedAxios.head.mockResolvedValue({
        headers: {
          'content-type': 'video/mp4',
          'content-length': '50000000', // 50MB
        },
      });

      const result = await (service as any).downloadAndValidateMedia(
        mockMediaUrl,
      );

      expect(result).toEqual({
        type: MediaType.VIDEO,
        mimeType: 'video/mp4',
      });
    });

    it('should throw error if image size exceeds limit', async () => {
      mockedAxios.head.mockResolvedValue({
        headers: {
          'content-type': 'image/jpeg',
          'content-length': '10000000', // 10MB (exceeds 8MB limit)
        },
      });

      await expect(
        (service as any).downloadAndValidateMedia(mockMediaUrl),
      ).rejects.toThrow(
        new HttpException(
          'Image file size exceeds 8MB limit',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw error if video size exceeds limit', async () => {
      mockedAxios.head.mockResolvedValue({
        headers: {
          'content-type': 'video/mp4',
          'content-length': '400000000', // 400MB (exceeds 300MB limit)
        },
      });

      await expect(
        (service as any).downloadAndValidateMedia(mockMediaUrl),
      ).rejects.toThrow(
        new HttpException(
          'Video file size exceeds 300MB limit for Reels',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw error for unsupported media type', async () => {
      mockedAxios.head.mockResolvedValue({
        headers: {
          'content-type': 'application/pdf', // Unsupported
          'content-length': '1000000',
        },
      });

      await expect(
        (service as any).downloadAndValidateMedia(mockMediaUrl),
      ).rejects.toThrow(
        new HttpException(
          'Unsupported media type: application/pdf',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network timeout');
      mockedAxios.head.mockRejectedValue(networkError);

      await expect(
        (service as any).downloadAndValidateMedia(mockMediaUrl),
      ).rejects.toThrow(
        new HttpException(
          'Failed to validate media: Network timeout',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  describe('waitForMediaProcessing', () => {
    it('should complete when media processing finishes', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { status_code: 'FINISHED' },
      });

      await expect(
        (service as any).waitForMediaProcessing(
          mockMediaContainerId,
          'https://graph.facebook.com/v18.0',
          mockAccessToken,
        ),
      ).resolves.toBeUndefined();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockMediaContainerId}`),
        expect.objectContaining({
          params: {
            fields: 'status_code',
            access_token: mockAccessToken,
          },
          timeout: 10000,
        }),
      );
    });

    it('should retry and eventually succeed', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: { status_code: 'IN_PROGRESS' } })
        .mockResolvedValueOnce({ data: { status_code: 'IN_PROGRESS' } })
        .mockResolvedValueOnce({ data: { status_code: 'FINISHED' } });

      await expect(
        (service as any).waitForMediaProcessing(
          mockMediaContainerId,
          'https://graph.facebook.com/v18.0',
          mockAccessToken,
        ),
      ).resolves.toBeUndefined();

      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });
  });

  describe('createCarouselContainer', () => {
    it('should create a carousel container with multiple media IDs', async () => {
      const mediaIds = ['media-1', 'media-2', 'media-3'];
      const caption = 'Test carousel';

      mockedAxios.post.mockResolvedValue({
        data: { id: 'carousel-container-id' },
      });

      mockedAxios.get.mockResolvedValue({
        data: { status_code: 'FINISHED' },
      });

      const result = await (service as any).createCarouselContainer(
        mockIgBusinessAccountId,
        mediaIds,
        caption,
        'https://graph.facebook.com/v18.0',
        mockAccessToken,
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockIgBusinessAccountId}/media`),
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      expect(result).toBe('carousel-container-id');
    });

    it('should handle API errors', async () => {
      const mediaIds = ['media-1', 'media-2'];
      const apiError = new Error('API Error');

      mockedAxios.post.mockRejectedValue(apiError);

      await expect(
        (service as any).createCarouselContainer(
          mockIgBusinessAccountId,
          mediaIds,
          'Test caption',
          'https://graph.facebook.com/v18.0',
          mockAccessToken,
        ),
      ).rejects.toThrow(InstagramApiException);
    });
  });

  describe('getInsightValue', () => {
    it('should extract value from insights array', () => {
      const insights = [
        { name: 'follower_count', values: [{ value: 5000 }] },
        { name: 'impressions', values: [{ value: 25000 }] },
      ];

      const result = (service as any).getInsightValue(
        insights,
        'follower_count',
      );

      expect(result).toBe(5000);
    });

    it('should return 0 if insight not found', () => {
      const insights = [{ name: 'follower_count', values: [{ value: 5000 }] }];

      const result = (service as any).getInsightValue(
        insights,
        'profile_views',
      );

      expect(result).toBe(0);
    });

    it('should handle empty insights array', () => {
      const result = (service as any).getInsightValue([], 'follower_count');

      expect(result).toBe(0);
    });
  });

  describe('getApiConfig', () => {
    it('should return Instagram Graph URL config for business login', () => {
      const result = (service as any).getApiConfig(mockBusinessLoginAccount);

      expect(result).toEqual({
        baseUrl: 'https://graph.instagram.com',
        accessToken: mockAccessToken,
        instagramAccountId: mockIgBusinessAccountId,
      });
    });

    it('should return Facebook Graph URL config for Facebook login', () => {
      const result = (service as any).getApiConfig(mockInstagramAccount);

      expect(result).toEqual({
        baseUrl: 'https://graph.facebook.com/v18.0',
        accessToken: mockAccessToken, // facebookPageAccessToken
        instagramAccountId: mockIgBusinessAccountId,
      });
    });

    it('should fallback to social account access token when no page token', () => {
      const accountWithoutPageToken = {
        ...mockInstagramAccount,
        facebookPageAccessToken: null,
      };

      const result = (service as any).getApiConfig(accountWithoutPageToken);

      expect(result.accessToken).toBe(mockAccessToken);
    });
  });
});
