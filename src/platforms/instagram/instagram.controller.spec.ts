import { Test, TestingModule } from '@nestjs/testing';
import { InstagramController } from './instagram.controller';
import { InstagramService } from './instagram.service';
import { InstagramErrorInterceptor } from './interceptors/instagram-error.interceptor';
import { RateLimitInterceptor } from './interceptors/rate-limit.interceptor';
import { CreatePostDto, CreateStoryDto } from './helpers/create-content.dto';
import { MediaItem } from '../platform-service.interface';
import { InstagramRepository } from './repositories/instagram.repository';

describe('InstagramController', () => {
  let controller: InstagramController;
  let instagramService: jest.Mocked<InstagramService>;

  const mockAccountId = 'test-account-123';
  const mockMediaId = 'test-media-456';
  const mockPageToken = 'next-page-token';

  beforeEach(async () => {
    // Create mock implementation of InstagramService
    const mockInstagramService = {
      post: jest.fn(),
      createStory: jest.fn(),
      getComments: jest.fn(),
      getPostMetrics: jest.fn(),
      getAccountInsights: jest.fn(),
    };

    // Create mocks for interceptors' dependencies
    const mockInstagramRepository = {
      checkRateLimit: jest.fn().mockResolvedValue(true),
      recordRateLimitUsage: jest.fn(),
      setTenantId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InstagramController],
      providers: [
        {
          provide: InstagramService,
          useValue: mockInstagramService,
        },
        {
          provide: InstagramRepository,
          useValue: mockInstagramRepository,
        },
        InstagramErrorInterceptor,
        RateLimitInterceptor,
      ],
    }).compile();

    controller = module.get<InstagramController>(InstagramController);
    instagramService = module.get(
      InstagramService,
    ) as jest.Mocked<InstagramService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPost', () => {
    it('should create a post with both uploaded files and media URLs', async () => {
      // Arrange
      const createPostDto: CreatePostDto = {
        caption: 'Test post caption',
        hashtags: ['test', 'instagram'],
        mentions: ['user1', 'user2'],
        mediaUrls: ['https://example.com/image1.jpg'],
      };

      const mockFiles = [
        {
          fieldname: 'files',
          originalname: 'test-image.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('test image data'),
          size: 1234,
        },
      ] as Express.Multer.File[];

      const expectedMedia: MediaItem[] = [
        { file: mockFiles[0], url: undefined },
        { url: 'https://example.com/image1.jpg', file: undefined },
      ];

      const expectedResponse = {
        platformPostId: 'instagram-post-123',
        postedAt: new Date(),
      };

      instagramService.post.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.createPost(
        mockAccountId,
        createPostDto,
        mockFiles,
      );

      // Assert
      expect(instagramService.post).toHaveBeenCalledWith(
        mockAccountId,
        createPostDto,
        expectedMedia,
      );
      expect(result).toBe(expectedResponse);
    });

    it('should create a post with only file uploads and no media URLs', async () => {
      // Arrange
      const createPostDto: CreatePostDto = {
        caption: 'Test post with files only',
        hashtags: ['test'],
        mentions: [],
      };

      const mockFiles = [
        {
          fieldname: 'files',
          originalname: 'test-image1.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('test image data 1'),
          size: 1234,
        },
        {
          fieldname: 'files',
          originalname: 'test-image2.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('test image data 2'),
          size: 5678,
        },
      ] as Express.Multer.File[];

      const expectedMedia: MediaItem[] = [
        { file: mockFiles[0], url: undefined },
        { file: mockFiles[1], url: undefined },
      ];

      const expectedResponse = {
        platformPostId: 'instagram-post-456',
        postedAt: new Date(),
      };

      instagramService.post.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.createPost(
        mockAccountId,
        createPostDto,
        mockFiles,
      );

      // Assert
      expect(instagramService.post).toHaveBeenCalledWith(
        mockAccountId,
        createPostDto,
        expectedMedia,
      );
      expect(result).toBe(expectedResponse);
    });

    it('should create a post with only media URLs and no file uploads', async () => {
      // Arrange
      const createPostDto: CreatePostDto = {
        caption: 'Test post with URLs only',
        hashtags: ['test', 'urls'],
        mentions: ['user1'],
        mediaUrls: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.jpg',
        ],
      };

      const expectedMedia: MediaItem[] = [
        { url: 'https://example.com/image1.jpg', file: undefined },
        { url: 'https://example.com/image2.jpg', file: undefined },
      ];

      const expectedResponse = {
        platformPostId: 'instagram-post-789',
        postedAt: new Date(),
      };

      instagramService.post.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.createPost(
        mockAccountId,
        createPostDto,
        undefined,
      );

      // Assert
      expect(instagramService.post).toHaveBeenCalledWith(
        mockAccountId,
        createPostDto,
        expectedMedia,
      );
      expect(result).toBe(expectedResponse);
    });

    it('should create a post with no media (empty arrays)', async () => {
      // Arrange
      const createPostDto: CreatePostDto = {
        caption: 'Test post with no media',
        hashtags: [],
        mentions: [],
      };

      const expectedMedia: MediaItem[] = [];

      const expectedResponse = {
        platformPostId: 'instagram-post-999',
        postedAt: new Date(),
      };

      instagramService.post.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.createPost(
        mockAccountId,
        createPostDto,
        [],
      );

      // Assert
      expect(instagramService.post).toHaveBeenCalledWith(
        mockAccountId,
        createPostDto,
        expectedMedia,
      );
      expect(result).toBe(expectedResponse);
    });
  });

  describe('createStory', () => {
    it('should create a story with media URL and stickers', async () => {
      // Arrange
      const createStoryDto: CreateStoryDto = {
        mediaUrl: 'https://example.com/story-image.jpg',
        stickers: {
          poll: {
            question: 'Do you like this?',
            options: ['Yes', 'No'],
          },
        },
      };

      const expectedResponse = {
        platformPostId: 'instagram-story-123',
        postedAt: new Date(),
      };

      instagramService.createStory.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.createStory(
        mockAccountId,
        createStoryDto,
      );

      // Assert
      expect(instagramService.createStory).toHaveBeenCalledWith(
        mockAccountId,
        createStoryDto.mediaUrl,
        createStoryDto.stickers,
      );
      expect(result).toBe(expectedResponse);
    });

    it('should create a story without stickers', async () => {
      // Arrange
      const createStoryDto: CreateStoryDto = {
        mediaUrl: 'https://example.com/story-image.jpg',
      };

      const expectedResponse = {
        platformPostId: 'instagram-story-456',
        postedAt: new Date(),
      };

      instagramService.createStory.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.createStory(
        mockAccountId,
        createStoryDto,
      );

      // Assert
      expect(instagramService.createStory).toHaveBeenCalledWith(
        mockAccountId,
        createStoryDto.mediaUrl,
        undefined,
      );
      expect(result).toBe(expectedResponse);
    });
  });

  describe('getComments', () => {
    it('should get comments with page token', async () => {
      // Arrange
      const expectedResponse = {
        items: [
          {
            id: 'comment-1',
            content: 'Great post!',
            authorId: 'user-123',
            authorName: 'User One',
            createdAt: new Date(),
          },
          {
            id: 'comment-2',
            content: 'Awesome!',
            authorId: 'user-456',
            authorName: 'User Two',
            createdAt: new Date(),
          },
        ],
        nextPageToken: 'next-page-token-abc',
      };

      instagramService.getComments.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.getComments(
        mockAccountId,
        mockMediaId,
        mockPageToken,
      );

      // Assert
      expect(instagramService.getComments).toHaveBeenCalledWith(
        mockAccountId,
        mockMediaId,
        mockPageToken,
      );
      expect(result).toBe(expectedResponse);
    });

    it('should get comments without page token', async () => {
      // Arrange
      const expectedResponse = {
        items: [
          {
            id: 'comment-1',
            content: 'Great post!',
            authorId: 'user-123',
            authorName: 'User One',
            createdAt: new Date(),
          },
        ],
        nextPageToken: null,
      };

      instagramService.getComments.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.getComments(mockAccountId, mockMediaId);

      // Assert
      expect(instagramService.getComments).toHaveBeenCalledWith(
        mockAccountId,
        mockMediaId,
        undefined,
      );
      expect(result).toBe(expectedResponse);
    });
  });

  describe('getMetrics', () => {
    it('should get metrics for a media post', async () => {
      // Arrange
      const expectedResponse = {
        engagement: 500,
        impressions: 10000,
        reach: 8000,
        reactions: 300,
        comments: 45,
        shares: 25,
        saves: 50,
        platformSpecific: {
          saved: 50,
          storyReplies: 0,
          storyTaps: 0,
          storyExits: 0,
        },
      };

      instagramService.getPostMetrics.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.getMetrics(mockAccountId, mockMediaId);

      // Assert
      expect(instagramService.getPostMetrics).toHaveBeenCalledWith(
        mockAccountId,
        mockMediaId,
      );
      expect(result).toBe(expectedResponse);
    });
  });

  describe('getAccountInsights', () => {
    it('should get insights for an account', async () => {
      // Arrange
      const expectedResponse = {
        followerCount: 5000,
        impressions: 25000,
        profileViews: 1500,
        reach: 20000,
      };

      instagramService.getAccountInsights.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.getAccountInsights(mockAccountId);

      // Assert
      expect(instagramService.getAccountInsights).toHaveBeenCalledWith(
        mockAccountId,
      );
      expect(result).toBe(expectedResponse);
    });
  });
});
