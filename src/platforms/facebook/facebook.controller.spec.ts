import { Test, TestingModule } from '@nestjs/testing';
import { FacebookController } from './facebook.controller';
import { FacebookService } from './facebook.service';
import {
  CreateFacebookPagePostDto,
  UpdatePageDto,
  UpdatePostDto,
} from './helpers/post.dto';
import { RateLimitInterceptor } from './helpers/rate-limit.interceptor';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { FacebookPage } from '../entities/facebook-entities/facebook-page.entity';
import { FacebookPost } from '../entities/facebook-entities/facebook-post.entity';

describe('FacebookController', () => {
  let controller: FacebookController;
  let facebookService: FacebookService;

  // Mock data
  const mockFile = {
    fieldname: 'files',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('test'),
    size: 4,
  } as Express.Multer.File;

  const mockUser = { userId: 'user123' };
  const mockAccountId = 'account123';
  const mockPageId = 'page123';
  const mockPostId = 'post123';
  // const mockContent = 'Test content';
  // const mockMediaUrls = ['https://example.com/image.jpg'];
  const mockCursor = 'next_page_token';

  // Setup mock service
  const mockFacebookService = {
    createPagePost: jest.fn(),
    schedulePagePost: jest.fn(),
    getComments: jest.fn(),
    getUserPages: jest.fn(),
    getPagePosts: jest.fn(),
    getPageInsights: jest.fn(),
    getPostMetrics: jest.fn(),
    editPost: jest.fn(),
    editPage: jest.fn(),
    deletePost: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FacebookController],
      providers: [
        {
          provide: FacebookService,
          useValue: mockFacebookService,
        },
      ],
    })
      .overrideGuard(ClerkAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideInterceptor(RateLimitInterceptor)
      .useValue({})
      .compile();

    controller = module.get<FacebookController>(FacebookController);
    facebookService = module.get<FacebookService>(FacebookService);

    // Reset mock calls before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPostForPage', () => {
    it('should create a post for a page with files', async () => {
      const createPostDto: CreateFacebookPagePostDto = {
        content: 'Page post content',
        media: [],
      } as unknown as CreateFacebookPagePostDto;
      const files = [mockFile];

      await controller.createPostForPage(mockPageId, createPostDto, files);

      // DTO should be updated with file
      expect(createPostDto.media).toContainEqual({ file: mockFile });
      expect(facebookService.createPagePost).toHaveBeenCalledWith(
        mockPageId,
        createPostDto,
      );
    });

    it('should create a post for a page without files', async () => {
      const createPostDto: CreateFacebookPagePostDto = {
        content: 'Page post content',
        media: [{ url: 'https://example.com/image.jpg' }],
      } as unknown as CreateFacebookPagePostDto;
      const files = [];

      await controller.createPostForPage(mockPageId, createPostDto, files);

      // DTO should remain unchanged
      expect(createPostDto.media).toEqual([
        { url: 'https://example.com/image.jpg' },
      ]);
      expect(facebookService.createPagePost).toHaveBeenCalledWith(
        mockPageId,
        createPostDto,
      );
    });

    it('should handle undefined files', async () => {
      const createPostDto: CreateFacebookPagePostDto = {
        content: 'Page post content',
        media: [],
      } as unknown as CreateFacebookPagePostDto;

      await controller.createPostForPage(mockPageId, createPostDto, undefined);

      expect(createPostDto.media).toEqual([]);
      expect(facebookService.createPagePost).toHaveBeenCalledWith(
        mockPageId,
        createPostDto,
      );
    });
  });

  describe('schedulePagePost', () => {
    it('should schedule a page post with files', async () => {
      const scheduleDto: CreateFacebookPagePostDto = {
        content: 'Scheduled page post content',
        media: [],
      } as unknown as CreateFacebookPagePostDto;
      const files = [mockFile];

      await controller.schedulePagePost(mockPageId, scheduleDto, files);

      // DTO should be updated with file
      expect(scheduleDto.media).toContainEqual({ file: mockFile });
      expect(facebookService.schedulePagePost).toHaveBeenCalledWith(
        mockPageId,
        scheduleDto,
      );
    });

    it('should schedule a page post without files', async () => {
      const scheduleDto = {
        content: 'Scheduled page post content',
        media: [{ url: 'https://example.com/image.jpg' }],
      } as unknown as CreateFacebookPagePostDto;
      const files = [];

      await controller.schedulePagePost(mockPageId, scheduleDto, files);

      // DTO should remain unchanged
      expect(scheduleDto.media).toEqual([
        { url: 'https://example.com/image.jpg' },
      ]);
      expect(facebookService.schedulePagePost).toHaveBeenCalledWith(
        mockPageId,
        scheduleDto,
      );
    });

    it('should handle undefined files', async () => {
      const scheduleDto = {
        content: 'Scheduled page post content',
        media: [],
      } as unknown as CreateFacebookPagePostDto;

      await controller.schedulePagePost(mockPageId, scheduleDto, undefined);

      expect(scheduleDto.media).toEqual([]);
      expect(facebookService.schedulePagePost).toHaveBeenCalledWith(
        mockPageId,
        scheduleDto,
      );
    });
  });

  describe('getComments', () => {
    it('should get comments without page token', async () => {
      await controller.getComments(mockUser, mockPostId);

      expect(facebookService.getComments).toHaveBeenCalledWith(
        mockUser.userId,
        mockPostId,
        undefined,
      );
    });

    it('should get comments with page token', async () => {
      const pageToken = 'page_token';
      await controller.getComments(mockUser, mockPostId, pageToken);

      expect(facebookService.getComments).toHaveBeenCalledWith(
        mockUser.userId,
        mockPostId,
        pageToken,
      );
    });
  });

  describe('getPages', () => {
    it('should get user pages', async () => {
      await controller.getPages(mockUser);

      expect(facebookService.getUserPages).toHaveBeenCalledWith(
        mockUser.userId,
      );
    });
  });

  describe('getPagePosts', () => {
    it('should get page posts with default limit', async () => {
      await controller.getPagePosts(mockPageId);

      expect(facebookService.getPagePosts).toHaveBeenCalledWith(
        mockPageId,
        10,
        undefined,
      );
    });

    it('should get page posts with custom limit and cursor', async () => {
      const limit = 20;
      await controller.getPagePosts(mockPageId, limit, mockCursor);

      expect(facebookService.getPagePosts).toHaveBeenCalledWith(
        mockPageId,
        limit,
        mockCursor,
      );
    });
  });

  describe('getPageInsights', () => {
    it('should get page insights with default period', async () => {
      await controller.getPageInsights(mockPageId);

      expect(facebookService.getPageInsights).toHaveBeenCalledWith(
        mockPageId,
        'days_28',
        undefined,
      );
    });

    it('should get page insights with custom period and metrics', async () => {
      const period = '90d';
      const metrics = 'page_impressions,page_engaged_users';
      await controller.getPageInsights(mockPageId, period, metrics);

      expect(facebookService.getPageInsights).toHaveBeenCalledWith(
        mockPageId,
        period,
        metrics,
      );
    });
  });

  describe('getPostMetrics', () => {
    it('should get post metrics', async () => {
      await controller.getPostMetrics(mockAccountId, mockPostId);

      expect(facebookService.getPostMetrics).toHaveBeenCalledWith(
        mockAccountId,
        mockPostId,
      );
    });
  });

  describe('updatePost', () => {
    it('should update a post with files', async () => {
      const updateDto: UpdatePostDto = {
        content: 'Updated content',
        media: [],
      };
      const files = [mockFile];
      const mockUpdatedPost = new FacebookPost();

      mockFacebookService.editPost.mockResolvedValue(mockUpdatedPost);

      const result = await controller.updatePost(mockPostId, updateDto, files);

      // DTO should be updated with file
      expect(updateDto.media).toContainEqual({ file: mockFile });
      expect(facebookService.editPost).toHaveBeenCalledWith(
        mockPostId,
        updateDto,
      );
      expect(result).toBe(mockUpdatedPost);
    });

    it('should update a post without files', async () => {
      const updateDto: UpdatePostDto = {
        content: 'Updated content',
        media: [{ url: 'https://example.com/image.jpg' }],
      };
      const files = [];
      const mockUpdatedPost = new FacebookPost();

      mockFacebookService.editPost.mockResolvedValue(mockUpdatedPost);

      const result = await controller.updatePost(mockPostId, updateDto, files);

      // DTO should remain unchanged
      expect(updateDto.media).toEqual([
        { url: 'https://example.com/image.jpg' },
      ]);
      expect(facebookService.editPost).toHaveBeenCalledWith(
        mockPostId,
        updateDto,
      );
      expect(result).toBe(mockUpdatedPost);
    });

    it('should handle undefined files', async () => {
      const updateDto: UpdatePostDto = {
        content: 'Updated content',
        media: [],
      };
      const mockUpdatedPost = new FacebookPost();

      mockFacebookService.editPost.mockResolvedValue(mockUpdatedPost);

      const result = await controller.updatePost(
        mockPostId,
        updateDto,
        undefined,
      );

      expect(updateDto.media).toEqual([]);
      expect(facebookService.editPost).toHaveBeenCalledWith(
        mockPostId,
        updateDto,
      );
      expect(result).toBe(mockUpdatedPost);
    });
  });

  describe('updatePage', () => {
    it('should update a page', async () => {
      const updateDto: UpdatePageDto = {
        name: 'Updated Page Name',
        description: 'Updated description',
      };
      const mockUpdatedPage = new FacebookPage();

      mockFacebookService.editPage.mockResolvedValue(mockUpdatedPage);

      const result = await controller.updatePage(mockPageId, updateDto);

      expect(facebookService.editPage).toHaveBeenCalledWith(
        mockPageId,
        updateDto,
      );
      expect(result).toBe(mockUpdatedPage);
    });
  });

  describe('deletePost', () => {
    it('should delete a post', async () => {
      await controller.deletePost(mockPostId);

      expect(facebookService.deletePost).toHaveBeenCalledWith(mockPostId);
    });
  });
});
