import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  HttpException,
  HttpStatus,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import axios from 'axios';
import { InstagramService } from './instagram.service';
import { InstagramRepository } from './repositories/instagram.repository';
import { MediaStorageService } from '../../asset-management/media-storage/media-storage.service';
import { TenantService } from '../../user-management/tenant/tenant.service';
import { InstagramApiException } from './helpers/instagram-api.exception';
import { CreatePostDto, CreateStoryDto } from './helpers/create-content.dto';
import { MediaType } from '../../common/enums/media-type.enum';
import { DateRange } from '../../common/interface/platform-metrics.interface';
import { SocialPlatform } from '../../common/enums/social-platform.enum';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('InstagramService', () => {
  let service: InstagramService;
  let instagramRepo: jest.Mocked<InstagramRepository>;
  let configService: jest.Mocked<ConfigService>;
  let mediaStorageService: jest.Mocked<MediaStorageService>;
  let tenantService: jest.Mocked<TenantService>;

  const mockTenantId = 'test-tenant-id';
  const mockAccountId = 'test-account-id';
  const mockPostId = 'test-post-id';
  const mockAccessToken = 'test-access-token';
  const mockRefreshToken = 'test-refresh-token';
  const mockIgBusinessAccountId = 'test-ig-business-id';
  const mockMediaContainerId = 'test-media-container-id';
  const mockMediaUrl = 'https://example.com/image.jpg';

  const mockInstagramAccount = {
    id: mockAccountId,
    instagramAccountId: mockIgBusinessAccountId,
    username: 'test_instagram',
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
      ],
    }).compile();

    service = module.get<InstagramService>(InstagramService);
    instagramRepo = module.get(
      InstagramRepository,
    ) as jest.Mocked<InstagramRepository>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
    mediaStorageService = module.get(
      MediaStorageService,
    ) as jest.Mocked<MediaStorageService>;
    tenantService = module.get(TenantService) as jest.Mocked<TenantService>;

    // Mock Logger to avoid console outputs during tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

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

      expect(tenantService.getTenantId).toHaveBeenCalled();
      expect(instagramRepo.setTenantId).toHaveBeenCalledWith(mockTenantId);
      expect(instagramRepo.getAccountByUserId).toHaveBeenCalledWith(
        mockAccountId,
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

      expect(tenantService.getTenantId).toHaveBeenCalled();
      expect(instagramRepo.setTenantId).toHaveBeenCalledWith(mockTenantId);
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
        new HttpException(
          'Failed to fetch account insights',
          HttpStatus.NOT_FOUND,
        ),
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

  describe('createStory', () => {
    it('should create an Instagram story', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockInstagramAccount as any,
      );

      // Mock media upload response
      mockedAxios.post.mockImplementation((url) => {
        if (url.includes('/media')) {
          return Promise.resolve({ data: { id: mockMediaContainerId } });
        }
        if (url.includes('/media_configure_to_story')) {
          return Promise.resolve({ data: { id: 'story-123' } });
        }
        return Promise.resolve({ data: {} });
      });

      // Mock media status check
      mockedAxios.get.mockResolvedValue({ data: { status_code: 'FINISHED' } });

      mockedAxios.head.mockResolvedValue({
        headers: {
          'content-type': 'image/jpeg',
          'content-length': '1000',
        },
      });

      const stickers = {
        poll: {
          question: 'Do you like this?',
          options: ['Yes', 'No'],
        },
      };

      const result = await service.createStory(
        mockAccountId,
        mockMediaUrl,
        stickers,
      );

      expect(tenantService.getTenantId).toHaveBeenCalled();
      expect(instagramRepo.setTenantId).toHaveBeenCalledWith(mockTenantId);
      expect(instagramRepo.getAccountByUserId).toHaveBeenCalledWith(
        mockAccountId,
      );

      // Verify media upload
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/media'),
        null,
        expect.objectContaining({
          params: expect.objectContaining({
            image_url: mockMediaUrl,
            access_token: mockAccessToken,
          }),
        }),
      );

      // Verify story configuration
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/media_configure_to_story'),
        null,
        expect.objectContaining({
          params: expect.objectContaining({
            media_id: mockMediaContainerId,
            source_type: '3',
            configure_mode: '1',
            stickers: JSON.stringify(stickers),
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

      // Mock API responses
      mockedAxios.post
        .mockImplementationOnce(() => {
          return Promise.resolve({ data: { id: mockMediaContainerId } });
        })
        .mockImplementationOnce(() => {
          return Promise.resolve({ data: { id: 'story-123' } });
        });

      mockedAxios.get.mockResolvedValue({ data: { status_code: 'FINISHED' } });

      mockedAxios.head.mockResolvedValue({
        headers: {
          'content-type': 'image/jpeg',
          'content-length': '1000',
        },
      });

      await service.createStory(mockAccountId, mockMediaUrl);

      // Verify story configuration without stickers
      const configureCall = mockedAxios.post.mock.calls.find((call) =>
        call[0].includes('/media_configure_to_story'),
      );

      expect(configureCall[2].params.stickers).toBeUndefined();
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

  describe('revokeAccess', () => {
    it('should revoke access token and delete account', async () => {
      instagramRepo.getAccountByUserId.mockResolvedValue(
        mockInstagramAccount as any,
      );
      mockedAxios.post.mockResolvedValue({ data: { success: true } });

      await service.revokeAccess(mockAccountId);

      expect(tenantService.getTenantId).toHaveBeenCalled();
      expect(instagramRepo.setTenantId).toHaveBeenCalledWith(mockTenantId);
      expect(instagramRepo.getAccountByUserId).toHaveBeenCalledWith(
        mockAccountId,
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/oauth/revoke/'),
        null,
        expect.objectContaining({
          params: expect.objectContaining({
            client_key: 'INSTAGRAM_CLIENT_ID',
            client_secret: 'INSTAGRAM_CLIENT_SECRET',
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
      mockedAxios.post.mockRejectedValue(apiError);

      await expect(service.revokeAccess(mockAccountId)).rejects.toThrow(
        InstagramApiException,
      );

      expect(instagramRepo.getAccountByUserId).toHaveBeenCalledWith(
        mockAccountId,
      );
      expect(mockedAxios.post).toHaveBeenCalled();
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

      // Since the service processes files one at a time, we need to mock sequential calls
      mediaStorageService.uploadPostMedia
        .mockResolvedValueOnce(uploadedMedia1 as any)
        .mockResolvedValueOnce(uploadedMedia2 as any);

      const result = await (service as any).uploadInstagramMediaItems(
        mediaItems,
        mockAccountId,
        'post',
      );

      // Verify each file was processed separately
      expect(mediaStorageService.uploadPostMedia).toHaveBeenCalledTimes(2);

      // First call with first file
      expect(mediaStorageService.uploadPostMedia).toHaveBeenNthCalledWith(
        1,
        mockAccountId,
        [mediaItems[0].file],
        expect.stringContaining('instagram-post-'),
      );

      // Second call with second file
      expect(mediaStorageService.uploadPostMedia).toHaveBeenNthCalledWith(
        2,
        mockAccountId,
        [mediaItems[1].file],
        expect.stringContaining('instagram-post-'),
      );

      // The result should be the concatenation of both uploads
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

      expect(mockedAxios.head).toHaveBeenCalledWith(mockMediaUrl);
      expect(result).toEqual({
        type: MediaType.IMAGE,
        mimeType: 'image/jpeg',
      });
    });

    it('should validate and identify video media', async () => {
      mockedAxios.head.mockResolvedValue({
        headers: {
          'content-type': 'video/mp4',
          'content-length': '3000000', // 3MB
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

    it('should throw error if file size exceeds limit', async () => {
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
          'File size exceeds 8MB limit',
          HttpStatus.BAD_REQUEST,
        ),
      );

      expect(mockedAxios.head).toHaveBeenCalledWith(mockMediaUrl);
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
        new HttpException('Unsupported media type', HttpStatus.BAD_REQUEST),
      );
    });
  });

  describe('getInstagramAccounts', () => {
    it('should retrieve Instagram business accounts connected to Facebook pages', async () => {
      const mockPagesResponse = {
        data: {
          data: [
            {
              id: 'page-1',
              name: 'Test Page 1',
              instagram_business_account: {
                id: 'ig-1',
                username: 'test_instagram_1',
              },
            },
            {
              id: 'page-2',
              name: 'Test Page 2',
              instagram_business_account: {
                id: 'ig-2',
                username: 'test_instagram_2',
              },
            },
            {
              id: 'page-3',
              name: 'Test Page 3',
              // No Instagram account connected
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockPagesResponse);

      const result = await (service as any).getInstagramAccounts(
        mockAccessToken,
      );

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/me/accounts'),
        expect.objectContaining({
          params: expect.objectContaining({
            access_token: mockAccessToken,
            fields: expect.stringContaining('instagram_business_account'),
          }),
        }),
      );

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('ig-1');
      expect(result[0].username).toBe('test_instagram_1');
      expect(result[0].pageId).toBe('page-1');

      expect(result[1].id).toBe('ig-2');
      expect(result[1].username).toBe('test_instagram_2');
      expect(result[1].pageId).toBe('page-2');
    });

    it('should return empty array if no Instagram accounts found', async () => {
      const mockPagesResponse = {
        data: {
          data: [
            {
              id: 'page-1',
              name: 'Test Page 1',
              // No Instagram account connected
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockPagesResponse);

      const result = await (service as any).getInstagramAccounts(
        mockAccessToken,
      );

      expect(result).toEqual([]);
    });
  });

  describe('checkMediaStatus', () => {
    it('should fetch and return media status', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          status_code: 'FINISHED',
        },
      });

      const result = await (service as any).checkMediaStatus(
        mockMediaContainerId,
        mockAccessToken,
      );

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockMediaContainerId}`),
        expect.objectContaining({
          params: expect.objectContaining({
            fields: 'status_code',
            access_token: mockAccessToken,
          }),
        }),
      );

      expect(result).toBe('FINISHED');
    });
  });

  describe('createMediaContainer', () => {
    it('should create a carousel container with multiple media IDs', async () => {
      const mediaIds = ['media-1', 'media-2', 'media-3'];

      mockedAxios.post.mockResolvedValue({
        data: {
          id: 'carousel-container-id',
        },
      });

      const result = await (service as any).createMediaContainer(
        mockIgBusinessAccountId,
        mediaIds,
        mockAccessToken,
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockIgBusinessAccountId}/media`),
        null,
        expect.objectContaining({
          params: expect.objectContaining({
            media_type: 'CAROUSEL',
            children: mediaIds.join(','),
            access_token: mockAccessToken,
          }),
        }),
      );

      expect(result).toBe('carousel-container-id');
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
});
