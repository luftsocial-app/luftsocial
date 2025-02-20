import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InstagramService } from './instagram.service';
import { InstagramRepository } from './repositories/instagram.repository';
import { InstagramConfig } from './helpers/instagram.config';
import { HttpException, NotFoundException } from '@nestjs/common';
import { InstagramApiException } from './helpers/instagram-api.exception';
import axios from 'axios';
import { MediaType } from './helpers/media-type.enum';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('InstagramService', () => {
  let service: InstagramService;
  let instagramRepo: InstagramRepository;
  let instagramConfig: InstagramConfig;

  const mockInstagramConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/callback',
    getAuthUrl: jest.fn(),
  };

  const mockInstagramRepo = {
    createAuthState: jest.fn(),
    getAccountByUserId: jest.fn(),
    checkRateLimit: jest.fn(),
    recordRateLimitUsage: jest.fn(),
    updateToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramService,
        {
          provide: InstagramConfig,
          useValue: mockInstagramConfig,
        },
        {
          provide: InstagramRepository,
          useValue: mockInstagramRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InstagramService>(InstagramService);
    instagramRepo = module.get<InstagramRepository>(InstagramRepository);
    instagramConfig = module.get<InstagramConfig>(InstagramConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authorize', () => {
    it('should generate authorization URL', async () => {
      const userId = 'test-user-id';
      const state = 'test-state';
      const expectedUrl = 'https://instagram.com/oauth/authorize';

      mockInstagramRepo.createAuthState.mockResolvedValue(state);
      mockInstagramConfig.getAuthUrl.mockReturnValue(expectedUrl);

      const result = await service.authorize(userId);

      expect(result).toBe(expectedUrl);
      expect(mockInstagramRepo.createAuthState).toHaveBeenCalledWith(userId);
      expect(mockInstagramConfig.getAuthUrl).toHaveBeenCalledWith(state);
    });
  });

  describe('handleCallback', () => {
    it('should handle callback successfully', async () => {
      const code = 'test-code';
      const tokenResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        scope: 'basic,comments',
      };

      const instagramAccounts = [
        {
          id: 'ig-account-1',
          username: 'test_user',
          pageId: 'fb-page-1',
        },
      ];

      mockedAxios.get
        .mockResolvedValueOnce({ data: tokenResponse })
        .mockResolvedValueOnce({
          data: {
            data: [
              {
                id: 'fb-page-1',
                instagram_business_account: {
                  id: 'ig-account-1',
                  username: 'test_user',
                },
              },
            ],
          },
        });

      const result = await service.handleCallback(code);

      expect(result).toEqual({
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresIn: tokenResponse.expires_in,
        tokenType: 'bearer',
        scope: ['basic', 'comments'],
        metadata: {
          instagramAccounts,
        },
      });
    });

    it('should throw exception when no Instagram accounts found', async () => {
      const code = 'test-code';

      mockedAxios.get
        .mockResolvedValueOnce({
          data: {
            access_token: 'test-token',
            scope: 'basic',
          },
        })
        .mockResolvedValueOnce({ data: { data: [] } });

      await expect(service.handleCallback(code)).rejects.toThrow(HttpException);
    });
  });

  describe('post', () => {
    it('should create a post with single media', async () => {
      const accountId = 'test-account';
      const content = 'Test caption';
      const mediaUrls = ['https://example.com/image.jpg'];

      const mockAccount = {
        accessToken: 'test-token',
        metadata: {
          instagramAccounts: [{ id: 'ig-account-1' }],
        },
      };

      mockInstagramRepo.getAccountByUserId.mockResolvedValue(mockAccount);
      mockedAxios.head.mockResolvedValue({
        headers: {
          'content-type': 'image/jpeg',
          'content-length': '1000000',
        },
      });

      mockedAxios.post
        .mockResolvedValueOnce({ data: { id: 'media-1' } }) // uploadMedia
        .mockResolvedValueOnce({ data: { id: 'post-1' } }); // media_publish

      mockedAxios.get.mockResolvedValue({
        data: { status_code: 'FINISHED' },
      });

      const result = await service.post(accountId, content, mediaUrls);

      expect(result).toEqual({
        platformPostId: 'post-1',
        postedAt: expect.any(Date),
      });
    });

    it('should throw error when media upload fails', async () => {
      const accountId = 'test-account';
      const content = 'Test caption';
      const mediaUrls = ['https://example.com/image.jpg'];

      const mockAccount = {
        accessToken: 'test-token',
        metadata: {
          instagramAccounts: [{ id: 'ig-account-1' }],
        },
      };

      mockInstagramRepo.getAccountByUserId.mockResolvedValue(mockAccount);
      mockedAxios.head.mockRejectedValue(new Error('Upload failed'));

      await expect(service.post(accountId, content, mediaUrls)).rejects.toThrow(
        InstagramApiException,
      );
    });
  });

  describe('getMetrics', () => {
    it('should return post metrics', async () => {
      const accountId = 'test-account';
      const postId = 'test-post';

      const mockAccount = {
        accessToken: 'test-token',
      };

      const mockMetricsResponse = {
        data: {
          data: [
            {
              name: 'engagement',
              values: [{ value: 100 }],
            },
            {
              name: 'impressions',
              values: [{ value: 1000 }],
            },
          ],
        },
      };

      mockInstagramRepo.getAccountByUserId.mockResolvedValue(mockAccount);
      mockedAxios.get.mockResolvedValue(mockMetricsResponse);

      const result = await service.getMetrics(accountId, postId);

      expect(result).toEqual({
        engagement: 100,
        impressions: 1000,
      });
    });
  });

  describe('getAccountInsights', () => {
    it('should return account insights', async () => {
      const accountId = 'test-account';
      const mockAccount = {
        instagramAccountId: 'ig-account-1',
        accessToken: 'test-token',
      };

      const mockInsightsResponse = {
        data: {
          data: [
            {
              name: 'follower_count',
              values: [{ value: 1000 }],
            },
            {
              name: 'impressions',
              values: [{ value: 5000 }],
            },
            {
              name: 'profile_views',
              values: [{ value: 300 }],
            },
            {
              name: 'reach',
              values: [{ value: 4000 }],
            },
          ],
        },
      };

      mockInstagramRepo.getAccountByUserId.mockResolvedValue(mockAccount);
      mockedAxios.get.mockResolvedValue(mockInsightsResponse);

      const result = await service.getAccountInsights(accountId);

      expect(result).toEqual({
        followerCount: 1000,
        impressions: 5000,
        profileViews: 300,
        reach: 4000,
      });
    });

    it('should throw error when account not found', async () => {
      const accountId = 'non-existent-account';

      mockInstagramRepo.getAccountByUserId.mockResolvedValue(null);

      await expect(service.getAccountInsights(accountId)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('createStory', () => {
    it('should create a story successfully', async () => {
      const accountId = 'test-account';
      const mediaUrl = 'https://example.com/story.jpg';
      const stickers = {
        hashtags: ['test'],
        location: { id: '123', name: 'Test Location' },
      };

      const mockAccount = {
        instagramAccountId: 'ig-account-1',
        accessToken: 'test-token',
      };

      mockInstagramRepo.getAccountByUserId.mockResolvedValue(mockAccount);
      mockedAxios.head.mockResolvedValue({
        headers: {
          'content-type': 'image/jpeg',
          'content-length': '1000000',
        },
      });

      mockedAxios.post
        .mockResolvedValueOnce({ data: { id: 'media-1' } }) // uploadMedia
        .mockResolvedValueOnce({ data: { id: 'story-1' } }); // media_configure_to_story

      mockedAxios.get.mockResolvedValue({
        data: { status_code: 'FINISHED' },
      });

      const result = await service.createStory(accountId, mediaUrl, stickers);

      expect(result).toEqual({
        platformPostId: 'story-1',
        postedAt: expect.any(Date),
      });
    });

    it('should throw error when story creation fails', async () => {
      const accountId = 'test-account';
      const mediaUrl = 'https://example.com/story.jpg';

      const mockAccount = {
        instagramAccountId: 'ig-account-1',
        accessToken: 'test-token',
      };

      mockInstagramRepo.getAccountByUserId.mockResolvedValue(mockAccount);
      mockedAxios.head.mockRejectedValue(new Error('Upload failed'));

      await expect(service.createStory(accountId, mediaUrl)).rejects.toThrow(
        InstagramApiException,
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const accountId = 'test-account';
      const mockAccount = {
        socialAccount: {
          accessToken: 'old-token',
        },
      };

      const mockRefreshResponse = {
        data: {
          access_token: 'new-token',
          expires_in: 3600,
        },
      };

      mockInstagramRepo.getAccountByUserId.mockResolvedValue(mockAccount);
      mockedAxios.get.mockResolvedValue(mockRefreshResponse);

      const result = await service.refreshToken(accountId);

      expect(result).toEqual({
        accessToken: 'new-token',
        refreshToken: null,
        expiresIn: 3600,
        tokenType: 'bearer',
        scope: ['basic', 'comments', 'relationships', 'media'],
      });

      expect(mockInstagramRepo.updateToken).toHaveBeenCalledWith(accountId, {
        accessToken: 'new-token',
        expiresIn: 3600,
      });
    });

    it('should throw error when account not found', async () => {
      const accountId = 'non-existent-account';

      mockInstagramRepo.getAccountByUserId.mockResolvedValue(null);

      await expect(service.refreshToken(accountId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('withRateLimit', () => {
    it('should execute action when within rate limit', async () => {
      const accountId = 'test-account';
      const action = 'post';
      const mockCallback = jest.fn().mockResolvedValue('success');

      mockInstagramRepo.checkRateLimit.mockResolvedValue(true);

      const result = await service.withRateLimit(
        accountId,
        action,
        mockCallback,
      );

      expect(result).toBe('success');
      expect(mockInstagramRepo.checkRateLimit).toHaveBeenCalledWith(
        accountId,
        action,
      );
      expect(mockInstagramRepo.recordRateLimitUsage).toHaveBeenCalledWith(
        accountId,
        action,
      );
    });

    it('should throw error when rate limit exceeded', async () => {
      const accountId = 'test-account';
      const action = 'post';
      const mockCallback = jest.fn();

      mockInstagramRepo.checkRateLimit.mockResolvedValue(false);

      await expect(
        service.withRateLimit(accountId, action, mockCallback),
      ).rejects.toThrow(HttpException);

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('getComments', () => {
    it('should return comments successfully', async () => {
      const accountId = 'test-account';
      const postId = 'test-post';
      const pageToken = 'next-page';

      const mockAccount = {
        accessToken: 'test-token',
      };

      const mockCommentsResponse = {
        data: {
          data: [
            {
              id: 'comment-1',
              text: 'Great post!',
              timestamp: '2024-02-14T12:00:00',
              username: 'user1',
            },
          ],
          paging: {
            cursors: {
              after: 'next-token',
            },
          },
        },
      };

      mockInstagramRepo.getAccountByUserId.mockResolvedValue(mockAccount);
      mockedAxios.get.mockResolvedValue(mockCommentsResponse);

      const result = await service.getComments(accountId, postId, pageToken);

      expect(result).toEqual({
        items: [
          {
            id: 'comment-1',
            content: 'Great post!',
            authorId: 'user1',
            authorName: 'user1',
            createdAt: expect.any(Date),
          },
        ],
        nextPageToken: 'next-token',
      });
    });

    it('should throw error when fetching comments fails', async () => {
      const accountId = 'test-account';
      const postId = 'test-post';

      mockInstagramRepo.getAccountByUserId.mockResolvedValue({
        accessToken: 'test-token',
      });
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      await expect(service.getComments(accountId, postId)).rejects.toThrow(
        InstagramApiException,
      );
    });
  });
});
