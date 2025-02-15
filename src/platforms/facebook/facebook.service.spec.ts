import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FacebookService } from './facebook.service';
import { FacebookRepository } from './repositories/facebook.repository';
import { NotFoundException, HttpException } from '@nestjs/common';
import axios from 'axios';
import { CreatePostDto, UpdatePageDto } from './helpers/post.dto';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FacebookService', () => {
  let service: FacebookService;
  let configService: ConfigService;
  let facebookRepo: FacebookRepository;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        FACEBOOK_CLIENT_ID: 'test-client-id',
        FACEBOOK_CLIENT_SECRET: 'test-client-secret',
        FACEBOOK_REDIRECT_URI: 'http://localhost:3000/callback',
      };
      return config[key];
    }),
  };

  const mockFacebookRepo = {
    createAuthState: jest.fn(),
    getAccountById: jest.fn(),
    getPostById: jest.fn(),
    getPageById: jest.fn(),
    createPost: jest.fn(),
    updatePost: jest.fn(),
    deletePost: jest.fn(),
    getAccountPages: jest.fn(),
    updatePageToken: jest.fn(),
    updatePage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacebookService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: FacebookRepository,
          useValue: mockFacebookRepo,
        },
      ],
    }).compile();

    service = module.get<FacebookService>(FacebookService);
    configService = module.get<ConfigService>(ConfigService);
    facebookRepo = module.get<FacebookRepository>(FacebookRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authorize', () => {
    it('should generate authorization URL', async () => {
      const userId = 'test-user-id';
      const state = 'test-state';
      mockFacebookRepo.createAuthState.mockResolvedValue(state);

      const url = await service.authorize(userId);

      expect(url).toContain('https://www.facebook.com/v18.0/dialog/oauth');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=http://localhost:3000/callback');
      expect(url).toContain(`state=${state}`);
      expect(mockFacebookRepo.createAuthState).toHaveBeenCalledWith(userId);
    });
  });

  describe('handleCallback', () => {
    it('should handle OAuth callback successfully', async () => {
      const code = 'test-code';
      const state = 'test-state';
      const userId = 'test-user-id';

      mockedAxios.get
        .mockResolvedValueOnce({ data: { access_token: 'short-lived-token' } }) // exchangeCodeForToken
        .mockResolvedValueOnce({ data: { access_token: 'long-lived-token' } }) // getLongLivedToken
        .mockResolvedValueOnce({
          data: { id: 'fb-user-id', name: 'Test User' },
        }) // getUserProfile
        .mockResolvedValueOnce({ data: { data: [] } }); // getPages

      const result = await service.handleCallback(code, state, userId);

      expect(result).toHaveProperty('accessToken', 'long-lived-token');
      expect(result).toHaveProperty('userData');
      expect(result).toHaveProperty('pages');
      expect(mockedAxios.get).toHaveBeenCalledTimes(4);
    });
  });

  describe('createPagePost', () => {
    it('should create a page post successfully', async () => {
      const pageId = 'test-page-id';
      const createPostDto: CreatePostDto = {
        content: 'Test post content',
        media: [{ url: 'https://example.com/image.jpg' }],
      };

      const mockPage = {
        id: pageId,
        pageId: 'fb-page-id',
        accessToken: 'page-access-token',
      };

      mockFacebookRepo.getPageById.mockResolvedValue(mockPage);
      mockedAxios.post.mockResolvedValueOnce({ data: { id: 'fb-post-id' } });

      const mockCreatedPost = {
        id: 'post-id',
        postId: 'fb-post-id',
        content: createPostDto.content,
      };
      mockFacebookRepo.createPost.mockResolvedValue(mockCreatedPost);

      const result = await service.createPagePost(pageId, createPostDto);

      expect(result).toEqual(mockCreatedPost);
      expect(mockFacebookRepo.getPageById).toHaveBeenCalledWith(pageId);
      expect(mockedAxios.post).toHaveBeenCalled();
      expect(mockFacebookRepo.createPost).toHaveBeenCalled();
    });

    it('should throw NotFoundException when page not found', async () => {
      const pageId = 'non-existent-page';
      const createPostDto: CreatePostDto = {
        content: 'Test post content',
      };

      mockFacebookRepo.getPageById.mockResolvedValue(null);

      await expect(
        service.createPagePost(pageId, createPostDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserPages', () => {
    it('should get and update user pages', async () => {
      const userId = 'test-user-id';
      const mockAccount = {
        id: 'account-id',
        accessToken: 'user-access-token',
      };
      const mockPages = [
        {
          id: 'page-1',
          pageId: 'fb-page-1',
          accessToken: 'old-token',
        },
      ];
      const mockFacebookPages = {
        data: [
          {
            id: 'fb-page-1',
            name: 'Test Page',
            access_token: 'new-token',
            category: 'Business',
            followers_count: 1000,
          },
        ],
      };

      mockFacebookRepo.getAccountById.mockResolvedValue(mockAccount);
      mockFacebookRepo.getAccountPages.mockResolvedValue(mockPages);
      mockedAxios.get.mockResolvedValue({ data: mockFacebookPages });

      const result = await service.getUserPages(userId);

      expect(result).toEqual(mockPages);
      expect(mockFacebookRepo.getAccountById).toHaveBeenCalledWith(userId);
      expect(mockFacebookRepo.getAccountPages).toHaveBeenCalledWith(
        mockAccount.id,
      );
      expect(mockFacebookRepo.updatePageToken).toHaveBeenCalled();
    });

    it('should throw NotFoundException when account not found', async () => {
      const userId = 'non-existent-user';
      mockFacebookRepo.getAccountById.mockResolvedValue(null);

      await expect(service.getUserPages(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('editPage', () => {
    it('should update page successfully', async () => {
      const pageId = 'test-page-id';
      const updateDto: UpdatePageDto = {
        name: 'Updated Page Name',
        about: 'Updated about section',
        description: 'Updated description',
        category: 'Updated Category',
        pageInfo: {
          website: 'https://example.com',
          phone: '1234567890',
          location: 'Test Location',
        },
      };

      const mockPage = {
        id: pageId,
        pageId: 'fb-page-id',
        accessToken: 'page-access-token',
        name: 'Old Name',
        category: 'Old Category',
        metadata: {},
      };

      const mockUpdatedPage = {
        ...mockPage,
        name: updateDto.name,
        category: updateDto.category,
        about: updateDto.about,
        description: updateDto.description,
        metadata: updateDto.pageInfo,
      };

      mockFacebookRepo.getPageById.mockResolvedValue(mockPage);
      mockedAxios.post.mockResolvedValue({ data: { success: true } });
      mockFacebookRepo.updatePage.mockResolvedValue(mockUpdatedPage);

      const result = await service.editPage(pageId, updateDto);

      expect(result).toEqual(mockUpdatedPage);
      expect(mockFacebookRepo.getPageById).toHaveBeenCalledWith(pageId);
      expect(mockedAxios.post).toHaveBeenCalled();
      expect(mockFacebookRepo.updatePage).toHaveBeenCalledWith(pageId, {
        name: updateDto.name,
        category: updateDto.category,
        about: updateDto.about,
        description: updateDto.description,
        metadata: {
          ...mockPage.metadata,
          ...updateDto.pageInfo,
        },
      });
    });

    it('should throw NotFoundException when page not found', async () => {
      const pageId = 'non-existent-page';
      const updateDto: UpdatePageDto = {
        name: 'Updated Name',
      };

      mockFacebookRepo.getPageById.mockResolvedValue(null);

      await expect(service.editPage(pageId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle Facebook API errors', async () => {
      const pageId = 'test-page-id';
      const updateDto: UpdatePageDto = {
        name: 'Updated Name',
      };

      mockFacebookRepo.getPageById.mockResolvedValue({
        id: pageId,
        pageId: 'fb-page-id',
        accessToken: 'page-access-token',
      });

      mockedAxios.post.mockRejectedValue(new Error('Facebook API Error'));

      await expect(service.editPage(pageId, updateDto)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('deletePost', () => {
    it('should delete post successfully', async () => {
      const postId = 'test-post-id';
      const mockPost = {
        id: postId,
        postId: 'fb-post-id',
        page: {
          accessToken: 'page-access-token',
        },
      };

      mockFacebookRepo.getPostById.mockResolvedValue(mockPost);
      mockedAxios.delete.mockResolvedValue({ data: { success: true } });

      await service.deletePost(postId);

      expect(mockFacebookRepo.getPostById).toHaveBeenCalledWith(postId);
      expect(mockedAxios.delete).toHaveBeenCalled();
      expect(mockFacebookRepo.deletePost).toHaveBeenCalledWith(postId);
    });

    it('should throw error when delete fails', async () => {
      const postId = 'test-post-id';
      const mockPost = {
        id: postId,
        postId: 'fb-post-id',
        page: {
          accessToken: 'page-access-token',
        },
      };

      mockFacebookRepo.getPostById.mockResolvedValue(mockPost);
      mockedAxios.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(service.deletePost(postId)).rejects.toThrow();
    });
  });

  describe('getPostMetrics', () => {
    it('should return post metrics successfully', async () => {
      const postId = 'test-post-id';
      const mockPost = {
        id: postId,
        postId: 'fb-post-id',
        page: {
          accessToken: 'page-access-token',
        },
      };

      const mockMetricsResponse = {
        data: {
          data: [
            {
              name: 'post_impressions',
              values: [{ value: 1000 }],
            },
            {
              name: 'post_engagements',
              values: [{ value: 500 }],
            },
          ],
        },
      };

      mockFacebookRepo.getPostById.mockResolvedValue(mockPost);
      mockedAxios.get.mockResolvedValue(mockMetricsResponse);

      const result = await service.getPostMetrics(postId);

      expect(result).toEqual({
        post_impressions: 1000,
        post_engagements: 500,
      });
      expect(mockFacebookRepo.getPostById).toHaveBeenCalledWith(postId);
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    it('should handle missing metrics gracefully', async () => {
      const postId = 'test-post-id';
      const mockPost = {
        id: postId,
        postId: 'fb-post-id',
        page: {
          accessToken: 'page-access-token',
        },
      };

      const mockMetricsResponse = {
        data: {
          data: [],
        },
      };

      mockFacebookRepo.getPostById.mockResolvedValue(mockPost);
      mockedAxios.get.mockResolvedValue(mockMetricsResponse);

      const result = await service.getPostMetrics(postId);

      expect(result).toEqual({});
    });
  });
});
