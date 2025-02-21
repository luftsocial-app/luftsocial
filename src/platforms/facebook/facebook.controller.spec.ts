import { Test, TestingModule } from '@nestjs/testing';
import { FacebookController } from './facebook.controller';
import { FacebookService } from './facebook.service';
import { SchedulePagePostDto, UpdatePageDto } from './helpers/post.dto';
import { FacebookPost } from './entity/facebook-post.entity';
import { FacebookPage } from './entity/facebook-page.entity';

describe('FacebookController', () => {
  let controller: FacebookController;
  let facebookService: FacebookService;

  const mockFacebookService = {
    authorize: jest.fn(),
    handleCallback: jest.fn(),
    post: jest.fn(),
    getComments: jest.fn(),
    getMetrics: jest.fn(),
    editPost: jest.fn(),
    deletePost: jest.fn(),
    createPagePost: jest.fn(),
    schedulePost: jest.fn(),
    schedulePagePost: jest.fn(),
    getUserPages: jest.fn(),
    getPagePosts: jest.fn(),
    getPageInsights: jest.fn(),
    getPostMetrics: jest.fn(),
    editPage: jest.fn(),
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
    }).compile();

    controller = module.get<FacebookController>(FacebookController);
    facebookService = module.get<FacebookService>(FacebookService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthUrl', () => {
    it('should return authorization URL', async () => {
      const userId = 'test-user-id';
      const expectedUrl = 'https://facebook.com/auth';
      mockFacebookService.authorize.mockResolvedValue(expectedUrl);

      const result = await controller.getAuthUrl(userId);

      expect(result).toEqual({ url: expectedUrl });
      expect(mockFacebookService.authorize).toHaveBeenCalledWith(userId);
    });
  });

  describe('handleCallback', () => {
    it('should handle OAuth callback', async () => {
      const code = 'test-code';
      const state = 'test-state';
      const userId = 'test-user-id';
      const expectedResponse = {
        accessToken: 'test-token',
        userData: { id: 'user-id' },
      };

      mockFacebookService.handleCallback.mockResolvedValue(expectedResponse);

      const result = await controller.handleCallback(code, state, userId);

      expect(result).toEqual(expectedResponse);
      expect(mockFacebookService.handleCallback).toHaveBeenCalledWith(
        code,
        state,
        userId,
      );
    });
  });

  describe('createPost', () => {
    it('should create a post', async () => {
      const accountId = 'test-account';
      const postData = {
        content: 'Test post',
        mediaUrls: ['https://example.com/image.jpg'],
      };
      const expectedResponse = {
        platformPostId: 'fb-post-id',
        postedAt: new Date(),
      };

      mockFacebookService.post.mockResolvedValue(expectedResponse);

      const result = await controller.createPost(accountId, postData);

      expect(result).toEqual(expectedResponse);
      expect(mockFacebookService.post).toHaveBeenCalledWith(
        accountId,
        postData.content,
        postData.mediaUrls,
      );
    });
  });

  describe('getComments', () => {
    it('should get post comments', async () => {
      const accountId = 'test-account';
      const postId = 'test-post';
      const pageToken = 'next-page';
      const expectedComments = {
        items: [
          {
            id: 'comment-1',
            content: 'Great post!',
            authorId: 'user-1',
            authorName: 'John Doe',
            createdAt: new Date(),
          },
        ],
        nextPageToken: 'next-token',
      };

      mockFacebookService.getComments.mockResolvedValue(expectedComments);

      const result = await controller.getComments(accountId, postId, pageToken);

      expect(result).toEqual(expectedComments);
      expect(mockFacebookService.getComments).toHaveBeenCalledWith(
        accountId,
        postId,
        pageToken,
      );
    });
  });

  describe('getPages', () => {
    it('should get user pages', async () => {
      const userId = 'test-user';
      const expectedPages = [
        {
          id: 'page-1',
          name: 'Test Page',
          category: 'Business',
        },
      ];

      mockFacebookService.getUserPages.mockResolvedValue(expectedPages);

      const result = await controller.getPages(userId);

      expect(result).toEqual(expectedPages);
      expect(mockFacebookService.getUserPages).toHaveBeenCalledWith(userId);
    });
  });

  describe('schedulePagePost', () => {
    it('should schedule a page post', async () => {
      const pageId = 'test-page';
      const scheduleDto: SchedulePagePostDto = {
        content: 'Scheduled post',
        scheduledTime: new Date().toISOString(),
        pageId: pageId,
        media: [{ url: 'https://example.com/image.jpg' }],
      };
      const expectedPost: FacebookPost = {
        id: 'post-1',
        postId: 'fb-post-1',
        content: scheduleDto.content,
        scheduledTime: scheduleDto.scheduledTime,
        media: scheduleDto.media,
      } as FacebookPost;

      mockFacebookService.schedulePagePost.mockResolvedValue(expectedPost);

      const result = await controller.schedulePagePost(pageId, scheduleDto);

      expect(result).toEqual(expectedPost);
      expect(mockFacebookService.schedulePagePost).toHaveBeenCalledWith(
        scheduleDto,
      );
    });
  });

  describe('updatePage', () => {
    it('should update a page', async () => {
      const pageId = 'test-page';
      const updateDto: UpdatePageDto = {
        name: 'Updated Page Name',
        about: 'Updated about section',
        category: 'Updated Category',
      };
      const expectedPage: FacebookPage = {
        id: pageId,
        name: updateDto.name,
        about: updateDto.about,
        category: updateDto.category,
      } as FacebookPage;

      mockFacebookService.editPage.mockResolvedValue(expectedPage);

      const result = await controller.updatePage(pageId, updateDto);

      expect(result).toEqual(expectedPage);
      expect(mockFacebookService.editPage).toHaveBeenCalledWith(
        pageId,
        updateDto,
      );
    });
  });
});
