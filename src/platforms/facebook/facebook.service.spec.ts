import { Test, TestingModule } from '@nestjs/testing';
import { FacebookService } from './facebook.service';
import { FacebookRepository } from './repositories/facebook.repository';
import { MediaStorageService } from '../../asset-management/media-storage/media-storage.service';
import { TenantService } from '../../user-management/tenant/tenant.service';
import { PinoLogger } from 'nestjs-pino';
import axios from 'axios';
import {
  CreateFacebookPagePostDto,
  UpdatePageDto,
  UpdatePostDto,
} from './helpers/post.dto';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { FacebookPage } from '../entities/facebook-entities/facebook-page.entity';
import { FacebookPost } from '../entities/facebook-entities/facebook-post.entity';
import { MediaType } from '../../common/enums/media-type.enum';
import { SocialPlatform } from '../../common/enums/social-platform.enum';
import * as config from 'config';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock config
jest.mock('config', () => ({
  get: jest.fn((key) => {
    if (key === 'platforms.facebook.clientId') return 'mock-client-id';
    if (key === 'platforms.facebook.clientSecret') return 'mock-client-secret';
    if (key === 'aws.s3.bucket') return 'mock-bucket';
    return null;
  }),
}));

describe('FacebookService', () => {
  let service: FacebookService;
  let facebookRepo: FacebookRepository;
  let mediaStorageService: MediaStorageService;
  let tenantService: TenantService;
  let logger: PinoLogger;

  // Mock data
  const mockTenantId = 'tenant123';
  const mockAccountId = 'account123';
  const mockPageId = 'page123';
  const mockPostId = 'post123';
  const mockFbPostId = 'fb_post_123';
  const mockAccessToken = 'mock-access-token';
  const mockFile = {
    fieldname: 'file',
    originalname: 'test.jpg',
    buffer: Buffer.from('test-file-content'),
    mimetype: 'image/jpeg',
    size: 1024,
  } as Express.Multer.File;

  // Mock repository methods
  const mockFacebookRepo = {
    setTenantId: jest.fn(),
    getAccountById: jest.fn(),
    getPageById: jest.fn(),
    getPostById: jest.fn(),
    getAccountPages: jest.fn(),
    createPost: jest.fn(),
    updatePost: jest.fn(),
    updatePage: jest.fn(),
    createPage: jest.fn(),
    deletePost: jest.fn(),
    deleteAccount: jest.fn(),
  };

  // Mock media storage service
  const mockMediaStorageService = {
    uploadPostMedia: jest.fn(),
    uploadMediaFromUrl: jest.fn(),
  };

  // Mock tenant service
  const mockTenantService = {
    getTenantId: jest.fn().mockReturnValue(mockTenantId),
  };

  // Mock logger
  const mockLogger = {
    setContext: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacebookService,
        {
          provide: FacebookRepository,
          useValue: mockFacebookRepo,
        },
        {
          provide: MediaStorageService,
          useValue: mockMediaStorageService,
        },
        {
          provide: TenantService,
          useValue: mockTenantService,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<FacebookService>(FacebookService);
    facebookRepo = module.get<FacebookRepository>(FacebookRepository);
    mediaStorageService = module.get<MediaStorageService>(MediaStorageService);
    tenantService = module.get<TenantService>(TenantService);
    logger = module.get<PinoLogger>(PinoLogger);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getComments', () => {
    it('should fetch comments for a post', async () => {
      // Mock repository response
      mockFacebookRepo.getAccountById.mockResolvedValue({
        socialAccount: {
          accessToken: mockAccessToken,
        },
      });

      // Mock axios response
      mockedAxios.get.mockResolvedValue({
        data: {
          data: [
            {
              id: 'comment1',
              message: 'Test comment',
              created_time: '2023-01-01T12:00:00Z',
              from: {
                id: 'user1',
                name: 'Test User',
              },
            },
          ],
          paging: {
            cursors: {
              after: 'next_page_token',
            },
            next: 'next_page_url',
          },
        },
      });

      const result = await service.getComments(mockAccountId, mockPostId);

      // Verify repository was called
      expect(mockFacebookRepo.getAccountById).toHaveBeenCalledWith(
        mockAccountId,
      );

      // Verify axios was called with correct parameters
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockPostId}/comments`),
        expect.objectContaining({
          params: expect.objectContaining({
            access_token: mockAccessToken,
            fields: 'from,message,created_time',
          }),
        }),
      );

      // Verify result structure
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('id', 'comment1');
      expect(result.pagination).toHaveProperty('nextToken', 'next_page_token');
      expect(result.pagination).toHaveProperty('hasMore', true);
    });

    it('should include page token in request if provided', async () => {
      // Mock repository response
      mockFacebookRepo.getAccountById.mockResolvedValue({
        socialAccount: {
          accessToken: mockAccessToken,
        },
      });

      // Mock axios response
      mockedAxios.get.mockResolvedValue({
        data: {
          data: [],
          paging: {},
        },
      });

      const pageToken = 'test_page_token';
      await service.getComments(mockAccountId, mockPostId, pageToken);

      // Verify axios was called with the page token
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            after: pageToken,
          }),
        }),
      );
    });
  });

  describe('getUserPages', () => {
    it('should fetch user pages and update local database', async () => {
      // Mock account data
      const mockAccount = {
        id: mockAccountId,
        facebookUserId: 'fb_user_123',
        socialAccount: {
          accessToken: mockAccessToken,
        },
      };

      // Mock existing pages
      const mockExistingPages = [
        {
          id: 'local_page_1',
          pageId: 'fb_page_1',
          name: 'Existing Page',
        },
      ];

      // Mock Facebook API response
      const mockFbPages = [
        {
          id: 'fb_page_1',
          name: 'Updated Page Name',
          category: 'Business',
          access_token: 'page_token_1',
          about: 'About text',
          description: 'Page description',
          followers_count: 100,
          tasks: ['CREATE_CONTENT'],
          category_list: [{ id: '123', name: 'Business' }],
        },
        {
          id: 'fb_page_2',
          name: 'New Page',
          category: 'Personal Blog',
          access_token: 'page_token_2',
          about: 'New page about',
          description: 'New page description',
          followers_count: 50,
          tasks: ['CREATE_CONTENT', 'MANAGE_JOBS'],
          category_list: [{ id: '456', name: 'Personal Blog' }],
        },
      ];

      // Set up mocks
      mockFacebookRepo.getAccountById.mockResolvedValue(mockAccount);
      mockFacebookRepo.getAccountPages.mockResolvedValueOnce(mockExistingPages);
      mockFacebookRepo.getAccountPages.mockResolvedValueOnce([
        { id: 'local_page_1', pageId: 'fb_page_1', name: 'Updated Page Name' },
        { id: 'local_page_2', pageId: 'fb_page_2', name: 'New Page' },
      ]);

      // Mock axios response
      mockedAxios.get.mockResolvedValue({
        data: {
          data: mockFbPages,
        },
      });

      mockFacebookRepo.updatePage.mockResolvedValue({});
      mockFacebookRepo.createPage.mockResolvedValue({});

      // Call the method
      const result = await service.getUserPages(mockAccountId);

      // Verify the function set tenant ID
      expect(mockFacebookRepo.setTenantId).toHaveBeenCalledWith(mockTenantId);

      // Verify it fetched the account
      expect(mockFacebookRepo.getAccountById).toHaveBeenCalledWith(
        mockAccountId,
      );

      // Verify it fetched existing pages
      expect(mockFacebookRepo.getAccountPages).toHaveBeenCalledWith(
        mockAccount.id,
      );

      // Verify it called the Facebook API
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockAccount.facebookUserId}/accounts`),
        expect.objectContaining({
          params: expect.objectContaining({
            access_token: mockAccessToken,
          }),
        }),
      );

      // Verify it updated the existing page
      expect(mockFacebookRepo.updatePage).toHaveBeenCalledWith(
        'local_page_1',
        expect.objectContaining({
          pageId: 'fb_page_1',
          name: 'Updated Page Name',
        }),
      );

      // Verify it created the new page
      expect(mockFacebookRepo.createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          pageId: 'fb_page_2',
          name: 'New Page',
          facebookAccount: mockAccount,
        }),
      );

      // Verify it returned the updated pages list
      expect(result).toHaveLength(2);
    });
  });

  describe('getPagePosts', () => {
    it('should fetch page posts with default limit', async () => {
      // Mock page data
      const mockPage = {
        pageId: 'fb_page_123',
        accessToken: 'page_token_123',
      };

      // Mock Facebook API response
      const mockPostsResponse = {
        data: [
          {
            id: 'post_1',
            message: 'Test post 1',
            created_time: '2023-01-01T12:00:00Z',
            attachments: { data: [] },
          },
          {
            id: 'post_2',
            message: 'Test post 2',
            created_time: '2023-01-02T12:00:00Z',
            attachments: { data: [] },
          },
        ],
        paging: {
          cursors: {
            after: 'next_cursor_token',
          },
        },
      };

      // Set up mocks
      mockFacebookRepo.getPageById.mockResolvedValue(mockPage);
      mockedAxios.get.mockResolvedValue({ data: mockPostsResponse });

      // Call the method
      const result = await service.getPagePosts(mockPageId);

      // Verify repository was called
      expect(mockFacebookRepo.setTenantId).toHaveBeenCalledWith(mockTenantId);
      expect(mockFacebookRepo.getPageById).toHaveBeenCalledWith(mockPageId);

      // Verify axios was called with correct parameters
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockPage.pageId}/feed`),
        expect.objectContaining({
          params: expect.objectContaining({
            access_token: mockPage.accessToken,
            limit: 10,
            fields: 'id,message,created_time,attachments',
          }),
        }),
      );

      // Verify result structure
      expect(result).toHaveProperty('posts', mockPostsResponse.data);
      expect(result).toHaveProperty('nextCursor', 'next_cursor_token');
    });

    it('should fetch page posts with custom limit and cursor', async () => {
      // Mock page data
      const mockPage = {
        pageId: 'fb_page_123',
        accessToken: 'page_token_123',
      };

      // Mock Facebook API response
      const mockPostsResponse = {
        data: [],
        paging: {
          cursors: {
            after: 'next_cursor_token',
          },
        },
      };

      // Set up mocks
      mockFacebookRepo.getPageById.mockResolvedValue(mockPage);
      mockedAxios.get.mockResolvedValue({ data: mockPostsResponse });

      // Call the method with custom limit and cursor
      const customLimit = 20;
      const customCursor = 'custom_cursor_token';
      await service.getPagePosts(mockPageId, customLimit, customCursor);

      // Verify axios was called with custom parameters
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            limit: customLimit,
            after: customCursor,
          }),
        }),
      );
    });
  });

  describe('getPageInsights', () => {
    it('should fetch page insights with default period', async () => {
      // Mock page data
      const mockPage = {
        pageId: 'fb_page_123',
        accessToken: 'page_token_123',
      };

      // Mock Facebook API response
      const mockInsightsResponse = {
        data: [
          {
            name: 'page_impressions',
            period: 'days_28',
            values: [
              { end_time: '2023-01-28T08:00:00+0000', value: 500 },
              { end_time: '2023-01-27T08:00:00+0000', value: 450 },
            ],
          },
          {
            name: 'page_post_engagements',
            period: 'days_28',
            values: [
              { end_time: '2023-01-28T08:00:00+0000', value: 100 },
              { end_time: '2023-01-27T08:00:00+0000', value: 90 },
            ],
          },
        ],
      };

      // Set up mocks
      mockFacebookRepo.getPageById.mockResolvedValue(mockPage);
      mockedAxios.get.mockResolvedValue({ data: mockInsightsResponse });

      // Call the method
      const result = await service.getPageInsights(mockPageId);

      // Verify repository was called
      expect(mockFacebookRepo.setTenantId).toHaveBeenCalledWith(mockTenantId);
      expect(mockFacebookRepo.getPageById).toHaveBeenCalledWith(mockPageId);

      // Verify axios was called with correct parameters
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockPage.pageId}/insights`),
        expect.objectContaining({
          params: expect.objectContaining({
            access_token: mockPage.accessToken,
            period: 'days_28',
          }),
        }),
      );

      // Verify result structure
      expect(result).toHaveProperty('period', 'days_28');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('summary');

      // Check metrics
      expect(result.metrics).toHaveProperty('page_impressions');
      expect(result.metrics.page_impressions).toHaveProperty(
        'current_value',
        500,
      );
      expect(result.metrics.page_impressions).toHaveProperty(
        'previous_value',
        450,
      );

      // Check summary
      expect(result.summary).toHaveProperty('impressions', 500);
      expect(result.summary).toHaveProperty('engagement', 100);
    });

    it('should throw BadRequestException for invalid period', async () => {
      await expect(
        service.getPageInsights(mockPageId, 'invalid_period'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if page not found', async () => {
      mockFacebookRepo.getPageById.mockResolvedValue(null);

      await expect(service.getPageInsights(mockPageId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should use custom metrics if provided', async () => {
      // Mock page data
      const mockPage = {
        pageId: 'fb_page_123',
        accessToken: 'page_token_123',
      };

      // Mock Facebook API response
      const mockInsightsResponse = {
        data: [
          {
            name: 'page_fans',
            period: 'days_28',
            values: [{ end_time: '2023-01-28T08:00:00+0000', value: 1000 }],
          },
        ],
      };

      // Set up mocks
      mockFacebookRepo.getPageById.mockResolvedValue(mockPage);
      mockedAxios.get.mockResolvedValue({ data: mockInsightsResponse });

      // Custom metrics
      const customMetrics = 'page_fans,page_fan_adds';

      // Call the method
      await service.getPageInsights(mockPageId, 'days_28', customMetrics);

      // Verify axios was called with custom metrics
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            metric: customMetrics,
          }),
        }),
      );
    });
  });

  describe('createPagePost', () => {
    it('should create a text-only post', async () => {
      // Mock page data
      const mockPage = {
        id: 'local_page_123',
        pageId: 'fb_page_123',
        accessToken: 'page_token_123',
        facebookAccount: { id: 'account123' },
      };

      // Mock DTO
      const createPostDto: CreateFacebookPagePostDto = {
        content: 'Test post content',
        published: true,
      };

      // Mock Facebook API response
      const mockPostResponse = {
        data: {
          id: 'fb_post_123',
        },
      };

      // Mock repository response
      const mockCreatedPost = new FacebookPost();
      mockCreatedPost.id = 'local_post_123';
      mockCreatedPost.postId = 'fb_post_123';
      mockCreatedPost.content = 'Test post content';

      // Set up mocks
      mockFacebookRepo.getPageById.mockResolvedValue(mockPage);
      mockedAxios.post.mockResolvedValue(mockPostResponse);
      mockFacebookRepo.createPost.mockResolvedValue(mockCreatedPost);

      // Call the method
      const result = await service.createPagePost(mockPageId, createPostDto);

      // Verify repository was called
      expect(mockFacebookRepo.setTenantId).toHaveBeenCalledWith(mockTenantId);
      expect(mockFacebookRepo.getPageById).toHaveBeenCalledWith(mockPageId);

      // Verify axios was called with correct parameters for text post
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockPage.pageId}/feed`),
        expect.objectContaining({
          message: createPostDto.content,
          published: true,
        }),
        expect.objectContaining({
          params: { access_token: mockPage.accessToken },
        }),
      );

      // Verify repository createPost was called
      expect(mockFacebookRepo.createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          page: mockPage,
          postId: 'fb_post_123',
          content: createPostDto.content,
          isPublished: true,
          publishedAt: expect.any(Date),
          tenantId: mockTenantId,
        }),
      );

      // Verify result
      expect(result).toBe(mockCreatedPost);
    });

    it('should create a link post', async () => {
      // Mock page data
      const mockPage = {
        id: 'local_page_123',
        pageId: 'fb_page_123',
        accessToken: 'page_token_123',
        facebookAccount: { id: 'account123' },
      };

      // Mock DTO
      const createPostDto: CreateFacebookPagePostDto = {
        content: 'Check out this link',
        link: 'https://example.com',
        published: true,
      };

      // Mock Facebook API response
      const mockPostResponse = {
        data: {
          id: 'fb_post_123',
        },
      };

      // Mock repository response
      const mockCreatedPost = new FacebookPost();
      mockCreatedPost.id = 'local_post_123';
      mockCreatedPost.postId = 'fb_post_123';
      mockCreatedPost.content = createPostDto.content;
      mockCreatedPost.permalinkUrl = createPostDto.link;

      // Set up mocks
      mockFacebookRepo.getPageById.mockResolvedValue(mockPage);
      mockedAxios.post.mockResolvedValue(mockPostResponse);
      mockFacebookRepo.createPost.mockResolvedValue(mockCreatedPost);

      // Call the method
      const result = await service.createPagePost(mockPageId, createPostDto);

      // Verify axios was called with correct parameters for link post
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockPage.pageId}/feed`),
        expect.objectContaining({
          message: createPostDto.content,
          link: createPostDto.link,
        }),
        expect.any(Object),
      );

      // Verify repository createPost was called with link
      expect(mockFacebookRepo.createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          permalinkUrl: createPostDto.link,
        }),
      );

      // Verify result
      expect(result).toBe(mockCreatedPost);
    });

    it('should handle a single photo post', async () => {
      // Mock page data
      const mockPage = {
        id: 'local_page_123',
        pageId: 'fb_page_123',
        accessToken: 'page_token_123',
        facebookAccount: { id: 'account123' },
      };

      // Mock DTO with photo
      const createPostDto: CreateFacebookPagePostDto = {
        content: 'Photo post',
        published: true,
        media: [
          {
            type: MediaType.IMAGE,
            url: 'https://example.com/image.jpg',
          },
        ],
      };

      // Mock Facebook API photo response
      const mockPhotoResponse = {
        data: {
          id: 'fb_photo_123',
          post_id: 'fb_post_123',
        },
      };

      // Mock repository response
      const mockCreatedPost = new FacebookPost();
      mockCreatedPost.id = 'local_post_123';
      mockCreatedPost.postId = 'fb_post_123';
      mockCreatedPost.content = createPostDto.content;
      mockCreatedPost.mediaItems = [
        {
          id: 'fb_photo_123',
          type: MediaType.IMAGE,
          url: 'https://example.com/image.jpg', // Using original URL for simplicity
          key: null,
        },
      ];

      // Set up mocks
      mockFacebookRepo.getPageById.mockResolvedValue(mockPage);
      mockedAxios.post.mockResolvedValue(mockPhotoResponse);
      mockFacebookRepo.createPost.mockResolvedValue(mockCreatedPost);

      // Call the method
      const result = await service.createPagePost(mockPageId, createPostDto);

      // Verify axios was called with correct parameters for photo post
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockPage.pageId}/photos`),
        expect.objectContaining({
          url: expect.any(String),
          message: createPostDto.content,
        }),
        expect.any(Object),
      );

      // Verify repository createPost was called with media info
      expect(mockFacebookRepo.createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          page: mockPage,
          postId: 'fb_post_123',
          content: createPostDto.content,
          mediaItems: expect.arrayContaining([
            expect.objectContaining({
              id: 'fb_photo_123',
              type: MediaType.IMAGE,
            }),
          ]),
        }),
      );

      // Verify result
      expect(result).toBe(mockCreatedPost);
    });
  });

  describe('schedulePagePost', () => {
    it('should schedule a post with valid scheduled time', async () => {
      // Create a future date (10 minutes + 1 hour from now to be safe)
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      futureDate.setMinutes(futureDate.getMinutes() + 10);

      // Mock DTO
      const scheduleDto: CreateFacebookPagePostDto = {
        content: 'Scheduled post content',
        scheduledPublishTime: futureDate.toISOString(),
      };

      // Mock createPagePost method
      jest
        .spyOn(service, 'createPagePost')
        .mockResolvedValue(new FacebookPost());

      // Call the method
      await service.schedulePagePost(mockPageId, scheduleDto);

      // Verify the DTO was modified correctly
      expect(scheduleDto.published).toBe(false);
      expect(scheduleDto.scheduledPublishTime).toBeInstanceOf(Date);

      // Verify createPagePost was called
      expect(service.createPagePost).toHaveBeenCalledWith(
        mockPageId,
        scheduleDto,
      );
    });

    it('should throw BadRequestException if scheduledPublishTime is missing', async () => {
      const scheduleDto: CreateFacebookPagePostDto = {
        content: 'Scheduled post content',
      };

      await expect(
        service.schedulePagePost(mockPageId, scheduleDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if scheduled time is too soon', async () => {
      // Time only 5 minutes in the future (less than 10 min requirement)
      const tooSoonDate = new Date();
      tooSoonDate.setMinutes(tooSoonDate.getMinutes() + 5);

      const scheduleDto: CreateFacebookPagePostDto = {
        content: 'Scheduled post content',
        scheduledPublishTime: tooSoonDate.toISOString(),
      };

      await expect(
        service.schedulePagePost(mockPageId, scheduleDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deletePost', () => {
    it('should delete a post', async () => {
      // Mock post data
      const mockPost = {
        postId: mockFbPostId,
        page: {
          accessToken: mockAccessToken,
        },
      };

      // Set up mocks
      mockFacebookRepo.getPostById.mockResolvedValue(mockPost);
      mockedAxios.delete.mockResolvedValue({ data: { success: true } });
      mockFacebookRepo.deletePost.mockResolvedValue(undefined);

      // Call the method
      await service.deletePost(mockPostId);

      // Verify tenant ID was set
      expect(mockFacebookRepo.setTenantId).toHaveBeenCalledWith(mockTenantId);

      // Verify post was retrieved
      expect(mockFacebookRepo.getPostById).toHaveBeenCalledWith(mockPostId);

      // Verify axios delete was called
      expect(mockedAxios.delete).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockPost.postId}`),
        expect.objectContaining({
          params: { access_token: mockPost.page.accessToken },
        }),
      );

      // Verify repository deletePost was called
      expect(mockFacebookRepo.deletePost).toHaveBeenCalledWith(mockPostId);
    });
  });

  describe('editPost', () => {
    it('should update a post', async () => {
      // Mock post data
      const mockPost = {
        id: mockPostId,
        postId: mockFbPostId,
        account: { id: mockAccountId },
        page: {
          accessToken: mockAccessToken,
        },
      };

      // Mock update DTO
      const updateDto: UpdatePostDto = {
        content: 'Updated post content',
        media: [],
      };

      // Mock updated post
      const mockUpdatedPost = new FacebookPost();
      mockUpdatedPost.id = mockPostId;
      mockUpdatedPost.content = updateDto.content;

      // Set up mocks
      mockFacebookRepo.getPostById.mockResolvedValue(mockPost);
      mockFacebookRepo.setTenantId.mockReturnValue(undefined);
      mockedAxios.post.mockResolvedValue({ data: { success: true } });
      mockFacebookRepo.updatePost.mockResolvedValue(mockUpdatedPost);

      // Call the method
      const result = await service.editPost(mockPostId, updateDto);

      // Verify tenant ID was set
      expect(mockFacebookRepo.setTenantId).toHaveBeenCalledWith(mockTenantId);

      // Verify post was retrieved with the page relation
      expect(mockFacebookRepo.getPostById).toHaveBeenCalledWith(mockPostId, [
        'page',
      ]);

      // Verify axios post was called to update the post
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockPost.postId}`),
        expect.objectContaining({
          message: updateDto.content,
        }),
        expect.objectContaining({
          params: { access_token: mockPost.page.accessToken },
        }),
      );

      // Verify repository updatePost was called
      expect(mockFacebookRepo.updatePost).toHaveBeenCalledWith(
        mockPostId,
        expect.objectContaining({
          content: updateDto.content,
          updatedAt: expect.any(Date),
        }),
      );

      // Verify result
      expect(result).toBe(mockUpdatedPost);
    });

    it('should throw NotFoundException if post not found', async () => {
      mockFacebookRepo.getPostById.mockResolvedValue(null);

      const updateDto: UpdatePostDto = {
        content: 'Updated content',
      };

      await expect(service.editPost(mockPostId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('editPage', () => {
    it('should update a page', async () => {
      // Mock page data
      const mockPage = {
        id: mockPageId,
        pageId: 'fb_page_123',
        accessToken: mockAccessToken,
        name: 'Original Page Name',
        category: 'Original Category',
        metadata: {
          existingKey: 'existingValue',
        },
      };

      // Mock update DTO
      const updateDto: UpdatePageDto = {
        name: 'Updated Page Name',
        about: 'Updated about text',
        description: 'Updated description',
        pageInfo: {
          website: 'https://example.com',
          phone: '123-456-7890',
        },
      };

      // Mock updated page
      const mockUpdatedPage = new FacebookPage();
      mockUpdatedPage.id = mockPageId;
      mockUpdatedPage.name = updateDto.name;
      mockUpdatedPage.about = updateDto.about;
      mockUpdatedPage.description = updateDto.description;

      // Set up mocks
      mockFacebookRepo.getPageById.mockResolvedValue(mockPage);
      mockedAxios.post.mockResolvedValue({ data: { success: true } });
      mockFacebookRepo.updatePage.mockResolvedValue(mockUpdatedPage);

      // Call the method
      const result = await service.editPage(mockPageId, updateDto);

      // Verify tenant ID was set
      expect(mockFacebookRepo.setTenantId).toHaveBeenCalledWith(mockTenantId);

      // Verify page was retrieved
      expect(mockFacebookRepo.getPageById).toHaveBeenCalledWith(mockPageId);

      // Verify axios post was called to update the page
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockPage.pageId}`),
        expect.objectContaining({
          about: updateDto.about,
          description: updateDto.description,
          website: updateDto.pageInfo.website,
          phone: updateDto.pageInfo.phone,
        }),
        expect.objectContaining({
          params: { access_token: mockPage.accessToken },
        }),
      );

      // Verify repository updatePage was called with merged metadata
      expect(mockFacebookRepo.updatePage).toHaveBeenCalledWith(
        mockPageId,
        expect.objectContaining({
          name: updateDto.name,
          about: updateDto.about,
          description: updateDto.description,
          metadata: expect.objectContaining({
            existingKey: 'existingValue',
            website: updateDto.pageInfo.website,
            phone: updateDto.pageInfo.phone,
          }),
        }),
      );

      // Verify result
      expect(result).toBe(mockUpdatedPage);
    });

    it('should throw NotFoundException if page not found', async () => {
      mockFacebookRepo.getPageById.mockResolvedValue(null);

      const updateDto: UpdatePageDto = {
        name: 'Updated Page Name',
      };

      await expect(service.editPage(mockPageId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPostMetrics', () => {
    it('should fetch post metrics', async () => {
      // Mock account and post data
      const mockAccount = {
        id: mockAccountId,
        socialAccount: {
          accessToken: mockAccessToken,
        },
      };

      const mockPost = {
        postId: mockFbPostId,
        page: {
          accessToken: mockAccessToken,
        },
      };

      // Here's the key change - the data structure is different
      // This matches what the Facebook API actually returns and what the service expects
      const mockMetricsData = [
        {
          name: 'post_impressions',
          values: [{ value: 1000 }],
        },
        {
          name: 'post_engaged_users',
          values: [{ value: 200 }],
        },
        {
          name: 'post_reactions_by_type_total',
          values: [{ value: { like: 150, love: 50 } }],
        },
        {
          name: 'post_clicks',
          values: [{ value: 300 }],
        },
        {
          name: 'post_video_views',
          values: [{ value: 500 }],
        },
        {
          name: 'post_video_view_time',
          values: [{ value: 7500 }],
        },
      ];

      // Set up mocks
      mockFacebookRepo.getAccountById.mockResolvedValue(mockAccount);
      mockFacebookRepo.getPostById.mockResolvedValue(mockPost);

      mockedAxios.get.mockResolvedValue({ data: mockMetricsData });

      // Call the method
      const result = await service.getPostMetrics(mockAccountId, mockPostId);

      // Verify tenant ID was set
      expect(mockFacebookRepo.setTenantId).toHaveBeenCalledWith(mockTenantId);

      // Verify account and post were retrieved
      expect(mockFacebookRepo.getAccountById).toHaveBeenCalledWith(
        mockAccountId,
      );
      expect(mockFacebookRepo.getPostById).toHaveBeenCalledWith(mockPostId);

      // Verify axios was called to fetch metrics
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockPost.postId}/insights`),
        expect.objectContaining({
          params: expect.objectContaining({
            access_token: mockPost.page.accessToken,
            metric: expect.any(String),
          }),
        }),
      );

      // Verify result structure
      expect(result).toHaveProperty('impressions', 1000);
      expect(result).toHaveProperty('engagedUsers', 200);
      expect(result).toHaveProperty('reactions', { like: 150, love: 50 });
      expect(result).toHaveProperty('clicks', 300);
      expect(result).toHaveProperty('videoViews', 500);
      expect(result).toHaveProperty('videoViewTime', 7500);
      expect(result).toHaveProperty('collectedAt');
    });

    it('should handle missing post gracefully', async () => {
      // Set up mocks - Post not found
      mockFacebookRepo.getAccountById.mockResolvedValue({
        id: mockAccountId,
        socialAccount: {
          accessToken: mockAccessToken,
        },
      });
      mockFacebookRepo.getPostById.mockResolvedValue(null);

      // Expect the method to throw a NotFoundException
      await expect(
        service.getPostMetrics(mockAccountId, mockPostId),
      ).rejects.toThrow();
    });

    it('should handle API errors properly', async () => {
      // Mock account and post data
      const mockAccount = {
        id: mockAccountId,
        socialAccount: {
          accessToken: mockAccessToken,
        },
      };

      const mockPost = {
        postId: mockFbPostId,
        page: {
          accessToken: mockAccessToken,
        },
      };

      // Mock an API error
      const mockError = new Error('API error');
      mockError.response = {
        data: {
          error: {
            message: 'Invalid token',
            code: 190,
          },
        },
      };

      // Set up mocks
      mockFacebookRepo.getAccountById.mockResolvedValue(mockAccount);
      mockFacebookRepo.getPostById.mockResolvedValue(mockPost);
      mockedAxios.get.mockRejectedValue(mockError);

      // Expect the method to throw a BadRequestException
      await expect(
        service.getPostMetrics(mockAccountId, mockPostId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getS3Url', () => {
    it('should generate correct S3 URL with default bucket', () => {
      const s3Key = 'path/to/file.jpg';
      const defaultBucket = 'mock-bucket';

      const url = service.getS3Url(s3Key);

      expect(url).toBe(`https://${defaultBucket}.s3.amazonaws.com/${s3Key}`);
      expect(config.get).toHaveBeenCalledWith('aws.s3.bucket');
    });

    it('should generate correct S3 URL with custom bucket', () => {
      const s3Key = 'path/to/file.jpg';
      const customBucket = 'custom-bucket';

      const url = service.getS3Url(s3Key, customBucket);

      expect(url).toBe(`https://${customBucket}.s3.amazonaws.com/${s3Key}`);
    });
  });

  describe('refreshLongLivedToken', () => {
    it('should exchange short-lived token for long-lived token', async () => {
      // Mock token
      const shortLivedToken = 'short-lived-token';

      // Mock API response
      const mockTokenResponse = {
        access_token: 'long-lived-token',
        token_type: 'bearer',
        expires_in: 5184000, // 60 days in seconds
      };

      // Set up mock
      mockedAxios.get.mockResolvedValue({ data: mockTokenResponse });

      // Call the method
      const result = await service.refreshLongLivedToken(shortLivedToken);

      // Verify axios was called with correct parameters
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/oauth/access_token'),
        expect.objectContaining({
          params: expect.objectContaining({
            grant_type: 'fb_exchange_token',
            client_id: 'mock-client-id',
            client_secret: 'mock-client-secret',
            fb_exchange_token: shortLivedToken,
          }),
        }),
      );

      // Verify result
      expect(result).toEqual(mockTokenResponse);
    });
  });

  describe('refreshPageToken', () => {
    it('should fetch a fresh page access token', async () => {
      // Mock data
      const pageId = 'page123';
      const userToken = 'user-access-token';

      // Mock API response
      const mockTokenResponse = {
        data: {
          access_token: 'new-page-token',
        },
      };

      // Set up mock
      mockedAxios.get.mockResolvedValue(mockTokenResponse);

      // Call the method
      const result = await service.refreshPageToken(pageId, userToken);

      // Verify axios was called with correct parameters
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`/${pageId}`),
        expect.objectContaining({
          params: expect.objectContaining({
            fields: 'access_token',
            access_token: userToken,
          }),
        }),
      );

      // Verify result
      expect(result).toEqual({
        access_token: 'new-page-token',
      });
    });
  });
});
