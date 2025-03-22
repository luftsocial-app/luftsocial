import { Test, TestingModule } from '@nestjs/testing';
import { FacebookController } from './facebook.controller';
import { FacebookService } from './facebook.service';
import {
  CreatePostDto,
  SchedulePagePostDto,
  SchedulePostDto,
  UpdatePageDto,
  UpdatePostDto,
} from './helpers/post.dto';
import { MediaItem } from '../platform-service.interface';
import { RateLimitInterceptor } from './helpers/rate-limit.interceptor';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { FacebookPage } from '../../entities/socials/facebook-entities/facebook-page.entity';
import { FacebookPost } from '../../entities/socials/facebook-entities/facebook-post.entity';

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

  const mockAccountId = 'account123';
  const mockPageId = 'page123';
  const mockPostId = 'post123';
  const mockUserId = 'user123';
  const mockContent = 'Test content';
  const mockMediaUrls = ['https://example.com/image.jpg'];
  const mockCursor = 'next_page_token';

  // Setup mock service
  const mockFacebookService = {
    post: jest.fn(),
    createPagePost: jest.fn(),
    schedulePost: jest.fn(),
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

  describe('createPost', () => {
    it('should create a post with content only', async () => {
      await controller.createPost(mockAccountId, mockContent);

      expect(facebookService.post).toHaveBeenCalledWith(
        mockAccountId,
        mockContent,
        [],
      );
    });

    it('should create a post with content and media URLs', async () => {
      await controller.createPost(mockAccountId, mockContent, mockMediaUrls);

      const expectedMedia: MediaItem[] = [
        { url: mockMediaUrls[0], file: undefined },
      ];

      expect(facebookService.post).toHaveBeenCalledWith(
        mockAccountId,
        mockContent,
        expectedMedia,
      );
    });

    it('should create a post with content and file uploads', async () => {
      const files = [mockFile];
      await controller.createPost(mockAccountId, mockContent, undefined, files);

      const expectedMedia: MediaItem[] = [{ file: mockFile, url: undefined }];

      expect(facebookService.post).toHaveBeenCalledWith(
        mockAccountId,
        mockContent,
        expectedMedia,
      );
    });

    it('should handle both file uploads and media URLs', async () => {
      const files = [mockFile];
      await controller.createPost(
        mockAccountId,
        mockContent,
        mockMediaUrls,
        files,
      );

      const expectedMedia: MediaItem[] = [
        { file: mockFile, url: undefined },
        { url: mockMediaUrls[0], file: undefined },
      ];

      expect(facebookService.post).toHaveBeenCalledWith(
        mockAccountId,
        mockContent,
        expectedMedia,
      );
    });
  });

  describe('createPostForPage', () => {
    it('should create a post for a page', async () => {
      const createPostDto: CreatePostDto = {
        content: 'Page post content',
        media: [],
      };
      const files = [mockFile];

      await controller.createPostForPage(mockPageId, createPostDto, files);

      // DTO should be updated with file
      expect(createPostDto.media).toContainEqual({ file: mockFile });
      expect(facebookService.createPagePost).toHaveBeenCalledWith(
        mockPageId,
        createPostDto,
      );
    });

    it('should handle empty files array', async () => {
      const createPostDto: CreatePostDto = {
        content: 'Page post content',
        media: [{ url: 'https://example.com/image.jpg' }],
      };

      await controller.createPostForPage(mockPageId, createPostDto, []);

      // DTO should remain unchanged
      expect(createPostDto.media).toEqual([
        { url: 'https://example.com/image.jpg' },
      ]);
      expect(facebookService.createPagePost).toHaveBeenCalledWith(
        mockPageId,
        createPostDto,
      );
    });
  });

  describe('schedulePost', () => {
    it('should schedule a post with files', async () => {
      const schedulePostDto: SchedulePostDto = {
        content: 'Scheduled post content',
        scheduledTime: new Date().toISOString(),
        media: [],
      };
      const files = [mockFile];

      await controller.schedulePost(mockAccountId, schedulePostDto, files);

      // DTO should be updated with file
      expect(schedulePostDto.media).toContainEqual({ file: mockFile });
      expect(facebookService.schedulePost).toHaveBeenCalledWith(
        mockAccountId,
        schedulePostDto,
      );
    });

    it('should schedule a post without files', async () => {
      const schedulePostDto: SchedulePostDto = {
        content: 'Scheduled post content',
        scheduledTime: new Date().toISOString(),
        media: [{ url: 'https://example.com/image.jpg' }],
      };

      await controller.schedulePost(mockAccountId, schedulePostDto);

      // DTO should remain unchanged
      expect(schedulePostDto.media).toEqual([
        { url: 'https://example.com/image.jpg' },
      ]);
      expect(facebookService.schedulePost).toHaveBeenCalledWith(
        mockAccountId,
        schedulePostDto,
      );
    });
  });

  describe('schedulePagePost', () => {
    it('should schedule a page post with files', async () => {
      const scheduleDto: SchedulePagePostDto = {
        pageId: mockPageId,
        content: 'Scheduled page post content',
        scheduledTime: new Date().toISOString(),
        media: [],
      };
      const files = [mockFile];

      await controller.schedulePagePost(mockPageId, scheduleDto, files);

      // DTO should be updated with file
      expect(scheduleDto.media).toContainEqual({ file: mockFile });
      expect(facebookService.schedulePagePost).toHaveBeenCalledWith(
        scheduleDto,
      );
    });

    it('should schedule a page post without files', async () => {
      const scheduleDto: SchedulePagePostDto = {
        pageId: mockPageId,
        content: 'Scheduled page post content',
        scheduledTime: new Date().toISOString(),
        media: [{ url: 'https://example.com/image.jpg' }],
      };

      await controller.schedulePagePost(mockPageId, scheduleDto, []);

      // DTO should remain unchanged
      expect(scheduleDto.media).toEqual([
        { url: 'https://example.com/image.jpg' },
      ]);
      expect(facebookService.schedulePagePost).toHaveBeenCalledWith(
        scheduleDto,
      );
    });
  });

  describe('getComments', () => {
    it('should get comments without page token', async () => {
      await controller.getComments(mockAccountId, mockPostId);

      expect(facebookService.getComments).toHaveBeenCalledWith(
        mockAccountId,
        mockPostId,
        undefined,
      );
    });

    it('should get comments with page token', async () => {
      const pageToken = 'page_token';
      await controller.getComments(mockAccountId, mockPostId, pageToken);

      expect(facebookService.getComments).toHaveBeenCalledWith(
        mockAccountId,
        mockPostId,
        pageToken,
      );
    });
  });

  describe('getPages', () => {
    it('should get user pages', async () => {
      await controller.getPages(mockUserId);

      expect(facebookService.getUserPages).toHaveBeenCalledWith(mockUserId);
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
        '30d',
      );
    });

    it('should get page insights with custom period', async () => {
      const period = '90d';
      await controller.getPageInsights(mockPageId, period);

      expect(facebookService.getPageInsights).toHaveBeenCalledWith(
        mockPageId,
        period,
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
      const mockUpdatedPost = new FacebookPost();

      mockFacebookService.editPost.mockResolvedValue(mockUpdatedPost);

      const result = await controller.updatePost(mockPostId, updateDto, []);

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
