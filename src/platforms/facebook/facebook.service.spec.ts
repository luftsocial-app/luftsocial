import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { FacebookService } from './facebook.service';
import { FacebookRepository } from './repositories/facebook.repository';
import { MediaStorageService } from '../../media-storage/media-storage.service';
import { TenantService } from '../../database/tenant.service';
import { NotFoundException } from '@nestjs/common';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FacebookService', () => {
  let service: FacebookService;
  let mockConfigService: Partial<ConfigService>;
  let mockFacebookRepository: Partial<FacebookRepository>;
  let mockMediaStorageService: Partial<MediaStorageService>;
  let mockTenantService: Partial<TenantService>;

  beforeEach(async () => {
    // Mock services
    mockConfigService = {
      get: jest.fn().mockReturnValue('mock-value'),
    };

    mockFacebookRepository = {
      setTenantId: jest.fn(),
      getAccountById: jest.fn(),
      getPageById: jest.fn(),
      getPostById: jest.fn(),
      createPost: jest.fn(),
      updatePost: jest.fn(),
      updatePage: jest.fn(),
      deleteAccount: jest.fn(),
      deletePost: jest.fn(),
      getAccountPages: jest.fn(),
      updatePageToken: jest.fn(),
    };

    mockMediaStorageService = {
      uploadPostMedia: jest.fn(),
      uploadMediaFromUrl: jest.fn(),
    };

    mockTenantService = {
      getTenantId: jest.fn().mockReturnValue('tenant-123'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacebookService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: FacebookRepository, useValue: mockFacebookRepository },
        { provide: MediaStorageService, useValue: mockMediaStorageService },
        { provide: TenantService, useValue: mockTenantService },
      ],
    }).compile();

    service = module.get<FacebookService>(FacebookService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should fetch user profile successfully', async () => {
      const mockResponse = {
        id: '12345',
        name: 'John Doe',
        email: 'john@example.com',
      };
      mockedAxios.get.mockResolvedValue({ data: mockResponse });

      const result = await service.getUserProfile('test-token');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/me',
        {
          params: {
            access_token: 'test-token',
            fields: 'id,name,email',
          },
        },
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('post', () => {
    it('should post content successfully', async () => {
      const mockAccount = {
        facebookUserId: 'user-123',
        socialAccount: { accessToken: 'test-token' },
      };
      const mockMediaStorageResult = [{ url: 'https://example.com/media.jpg' }];
      const mockFacebookUploadResponse = { data: { id: 'post-123' } };

      mockFacebookRepository.getAccountById = jest
        .fn()
        .mockResolvedValue(mockAccount);
      mockMediaStorageService.uploadPostMedia = jest
        .fn()
        .mockResolvedValue(mockMediaStorageResult);
      mockedAxios.post.mockResolvedValue(mockFacebookUploadResponse);
      mockFacebookRepository.createPost = jest.fn().mockResolvedValue({});

      const result = await service.post('user-123', 'Test post', [
        { file: {} as File, url: 'https://example.com/media.jpg' },
      ]);

      expect(mockFacebookRepository.setTenantId).toHaveBeenCalledWith(
        'tenant-123',
      );
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/user-123/feed',
        expect.objectContaining({
          message: 'Test post',
          link: 'https://example.com/media.jpg',
        }),
        expect.any(Object),
      );
      expect(result).toEqual({
        platformPostId: 'post-123',
        postedAt: expect.any(Date),
      });
    });

    it('should throw error if account not found', async () => {
      mockFacebookRepository.getAccountById = jest.fn().mockResolvedValue(null);

      await expect(service.post('user-123', 'Test post')).rejects.toThrow(
        'Account not found',
      );
    });
  });

  describe('schedulePost', () => {
    it('should schedule a post successfully', async () => {
      const mockPage = {
        id: 'page-123',
        pageId: 'fb-page-123',
        accessToken: 'page-token',
        facebookAccount: { id: 'account-123' },
      };
      const mockPost = {
        page: mockPage,
      };
      const scheduleDto = {
        content: 'Scheduled post',
        scheduledTime: new Date('2024-01-01T12:00:00Z'),
        media: [{ url: 'https://example.com/media.jpg' }],
      };
      const mockMediaStorageResult = [{ url: 'https://example.com/media.jpg' }];
      const mockFacebookScheduleResponse = {
        data: { id: 'scheduled-post-123' },
      };

      mockFacebookRepository.getPostById = jest
        .fn()
        .mockResolvedValue(mockPost);
      mockFacebookRepository.getPageById = jest
        .fn()
        .mockResolvedValue(mockPage);
      mockMediaStorageService.uploadPostMedia = jest
        .fn()
        .mockResolvedValue(mockMediaStorageResult);
      mockedAxios.post.mockResolvedValue(mockFacebookScheduleResponse);
      mockFacebookRepository.createPost = jest.fn().mockResolvedValue({});

      const result = await service.schedulePost('post-123', scheduleDto);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/fb-page-123/feed',
        expect.objectContaining({
          message: 'Scheduled post',
          published: false,
          scheduled_publish_time: expect.any(Number),
        }),
        expect.any(Object),
      );
      expect(mockFacebookRepository.createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          page: mockPage,
          postId: 'scheduled-post-123',
          content: 'Scheduled post',
          isPublished: false,
        }),
      );
    });

    it('should throw NotFoundException if post not found', async () => {
      mockFacebookRepository.getPostById = jest.fn().mockResolvedValue(null);

      await expect(
        service.schedulePost('post-123', {
          content: 'Scheduled post',
          scheduledTime: new Date().toISOString(),
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getComments', () => {
    it('should fetch comments successfully', async () => {
      const mockPost = {
        postId: 'fb-post-123',
        page: { accessToken: 'page-token' },
      };
      const mockCommentsResponse = {
        data: {
          data: [
            {
              id: 'comment-1',
              message: 'Great post!',
              created_time: '2024-01-01T12:00:00Z',
              from: { id: 'user-123', name: 'John Doe' },
            },
          ],
          paging: { cursors: { after: 'next-page-token' } },
        },
      };

      mockFacebookRepository.getPostById = jest
        .fn()
        .mockResolvedValue(mockPost);
      mockedAxios.get.mockResolvedValue(mockCommentsResponse);

      const result = await service.getComments('account-123', 'post-123');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/fb-post-123/comments',
        expect.objectContaining({
          params: expect.objectContaining({
            access_token: 'page-token',
            fields: 'id,message,created_time,from',
          }),
        }),
      );
      expect(result).toEqual({
        items: [
          {
            id: 'comment-1',
            content: 'Great post!',
            authorId: 'user-123',
            authorName: 'John Doe',
            createdAt: expect.any(Date),
          },
        ],
        nextPageToken: 'next-page-token',
      });
    });
  });

  describe('revokeAccess', () => {
    it('should revoke access and delete account', async () => {
      const mockAccount = {
        socialAccount: { accessToken: 'test-token' },
      };

      mockFacebookRepository.getAccountById = jest
        .fn()
        .mockResolvedValue(mockAccount);
      mockedAxios.post.mockResolvedValue({});

      await service.revokeAccess('account-123');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/oauth/revoke/',
        null,
        expect.objectContaining({
          params: expect.objectContaining({
            token: 'test-token',
          }),
        }),
      );
      expect(mockFacebookRepository.deleteAccount).toHaveBeenCalledWith(
        'account-123',
      );
    });

    it('should throw NotFoundException if account not found', async () => {
      mockFacebookRepository.getAccountById = jest.fn().mockResolvedValue(null);

      await expect(service.revokeAccess('account-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('refreshLongLivedToken', () => {
    it('should refresh long-lived token', async () => {
      const mockTokenResponse = {
        access_token: 'new-long-lived-token',
        expires_in: 60 * 60 * 24 * 60, // 60 days
      };

      mockedAxios.get.mockResolvedValue({ data: mockTokenResponse });

      const result = await service.refreshLongLivedToken('short-lived-token');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/oauth/access_token',
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: 'mock-value',
            client_secret: 'mock-value',
            fb_exchange_token: 'short-lived-token',
          },
        },
      );
      expect(result).toEqual(mockTokenResponse);
    });
  });

  describe('editPost', () => {
    it('should edit a post successfully', async () => {
      const mockPost = {
        postId: 'fb-post-123',
        page: { accessToken: 'page-token' },
        account: { id: 'account-123' },
      };
      const updateDto = {
        content: 'Updated post content',
        media: [{ url: 'https://example.com/new-media.jpg' }],
      };
      const mockMediaStorageResult = [
        { url: 'https://example.com/new-media.jpg' },
      ];

      mockFacebookRepository.getPostById = jest
        .fn()
        .mockResolvedValue(mockPost);
      mockMediaStorageService.uploadPostMedia = jest
        .fn()
        .mockResolvedValue(mockMediaStorageResult);
      mockedAxios.post.mockResolvedValue({});
      mockFacebookRepository.updatePost = jest.fn().mockResolvedValue({});

      await service.editPost('post-123', updateDto);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/fb-post-123',
        expect.objectContaining({
          message: 'Updated post content',
          attached_media: expect.any(Array),
        }),
        expect.any(Object),
      );
      expect(mockFacebookRepository.updatePost).toHaveBeenCalledWith(
        'post-123',
        expect.objectContaining({
          content: 'Updated post content',
          mediaItems: mockMediaStorageResult,
        }),
      );
    });

    it('should throw NotFoundException if post not found', async () => {
      mockFacebookRepository.getPostById = jest.fn().mockResolvedValue(null);

      await expect(
        service.editPost('post-123', { content: 'Updated content' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deletePost', () => {
    it('should delete a post successfully', async () => {
      const mockPost = {
        postId: 'fb-post-123',
        page: { accessToken: 'page-token' },
      };

      mockFacebookRepository.getPostById = jest
        .fn()
        .mockResolvedValue(mockPost);
      mockedAxios.delete.mockResolvedValue({});
      mockFacebookRepository.deletePost = jest.fn().mockResolvedValue({});

      await service.deletePost('post-123');

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/fb-post-123',
        {
          params: { access_token: 'page-token' },
        },
      );
      expect(mockFacebookRepository.deletePost).toHaveBeenCalledWith(
        'post-123',
      );
    });
  });
});
