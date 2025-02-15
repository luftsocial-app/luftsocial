import { Test, TestingModule } from '@nestjs/testing';
import { InstagramController } from './instagram.controller';
import { InstagramService } from './instagram.service';
import { CreatePostDto, CreateStoryDto } from './helpers/create-content.dto';

describe('InstagramController', () => {
  let controller: InstagramController;
  let instagramService: InstagramService;

  const mockInstagramService = {
    authorize: jest.fn(),
    handleCallback: jest.fn(),
    post: jest.fn(),
    createStory: jest.fn(),
    getComments: jest.fn(),
    getMetrics: jest.fn(),
    getAccountInsights: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InstagramController],
      providers: [
        {
          provide: InstagramService,
          useValue: mockInstagramService,
        },
      ],
    }).compile();

    controller = module.get<InstagramController>(InstagramController);
    instagramService = module.get<InstagramService>(InstagramService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthUrl', () => {
    it('should return authorization URL', async () => {
      const userId = 'test-user-id';
      const expectedUrl = 'https://instagram.com/oauth/authorize';
      mockInstagramService.authorize.mockResolvedValue(expectedUrl);

      const result = await controller.getAuthUrl(userId);

      expect(result).toEqual({ url: expectedUrl });
      expect(mockInstagramService.authorize).toHaveBeenCalledWith(userId);
    });
  });

  describe('handleCallback', () => {
    it('should handle OAuth callback successfully', async () => {
      const code = 'test-auth-code';
      const expectedResponse = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
        tokenType: 'bearer',
        scope: ['basic', 'comments'],
        metadata: {
          instagramAccounts: [{ id: 'account-1', username: 'test_user' }],
        },
      };

      mockInstagramService.handleCallback.mockResolvedValue(expectedResponse);

      const result = await controller.handleCallback(code);

      expect(result).toEqual(expectedResponse);
      expect(mockInstagramService.handleCallback).toHaveBeenCalledWith(code);
    });
  });

  describe('createPost', () => {
    it('should create a post successfully', async () => {
      const accountId = 'test-account-id';
      const createPostDto: CreatePostDto = {
        caption: 'Test caption',
        mediaUrls: ['https://example.com/image.jpg'],
      };
      const expectedResponse = {
        platformPostId: 'ig-media-id',
        postedAt: new Date(),
      };

      mockInstagramService.post.mockResolvedValue(expectedResponse);

      const result = await controller.createPost(accountId, createPostDto);

      expect(result).toEqual(expectedResponse);
      expect(mockInstagramService.post).toHaveBeenCalledWith(
        accountId,
        createPostDto.caption,
        createPostDto.mediaUrls,
      );
    });
  });

  describe('createStory', () => {
    it('should create a story successfully', async () => {
      const accountId = 'test-account-id';
      const createStoryDto: CreateStoryDto = {
        mediaUrl: 'https://example.com/story.jpg',
        stickers: {
          hashtags: ['test'],
          location: { id: '123', name: 'Test Location' },
        },
      };
      const expectedResponse = {
        platformPostId: 'ig-story-id',
        postedAt: new Date(),
      };

      mockInstagramService.createStory.mockResolvedValue(expectedResponse);

      const result = await controller.createStory(accountId, createStoryDto);

      expect(result).toEqual(expectedResponse);
      expect(mockInstagramService.createStory).toHaveBeenCalledWith(
        accountId,
        createStoryDto.mediaUrl,
        createStoryDto.stickers,
      );
    });
  });

  describe('getComments', () => {
    it('should get comments for a media', async () => {
      const accountId = 'test-account-id';
      const mediaId = 'test-media-id';
      const pageToken = 'next-page-token';
      const expectedResponse = {
        items: [
          {
            id: 'comment-1',
            content: 'Great post!',
            authorId: 'user1',
            authorName: 'User One',
            createdAt: new Date(),
          },
        ],
        nextPageToken: 'next-token',
      };

      mockInstagramService.getComments.mockResolvedValue(expectedResponse);

      const result = await controller.getComments(
        accountId,
        mediaId,
        pageToken,
      );

      expect(result).toEqual(expectedResponse);
      expect(mockInstagramService.getComments).toHaveBeenCalledWith(
        accountId,
        mediaId,
        pageToken,
      );
    });
  });

  describe('getMetrics', () => {
    it('should get metrics for a media', async () => {
      const accountId = 'test-account-id';
      const mediaId = 'test-media-id';
      const expectedMetrics = {
        engagement: 100,
        impressions: 1000,
        reach: 800,
        saved: 50,
      };

      mockInstagramService.getMetrics.mockResolvedValue(expectedMetrics);

      const result = await controller.getMetrics(accountId, mediaId);

      expect(result).toEqual(expectedMetrics);
      expect(mockInstagramService.getMetrics).toHaveBeenCalledWith(
        accountId,
        mediaId,
      );
    });
  });

  describe('getAccountInsights', () => {
    it('should get account insights', async () => {
      const accountId = 'test-account-id';
      const expectedInsights = {
        followerCount: 1000,
        impressions: 5000,
        profileViews: 300,
        reach: 4000,
      };

      mockInstagramService.getAccountInsights.mockResolvedValue(
        expectedInsights,
      );

      const result = await controller.getAccountInsights(accountId);

      expect(result).toEqual(expectedInsights);
      expect(mockInstagramService.getAccountInsights).toHaveBeenCalledWith(
        accountId,
      );
    });
  });
});
