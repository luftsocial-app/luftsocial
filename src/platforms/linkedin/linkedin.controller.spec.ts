import { Test, TestingModule } from '@nestjs/testing';
import { LinkedInController } from './linkedin.controller';
import { LinkedInService } from './linkedin.service';
import { LinkedInErrorInterceptor } from './helpers/linkedin-error.interceptor';
import { CreateLinkedInPostDto } from './helpers/create-post.dto';
import { MediaItem } from '../platform-service.interface';

describe('LinkedInController', () => {
  let controller: LinkedInController;
  let linkedInService: jest.Mocked<LinkedInService>;

  // Mock data
  const mockAccountId = 'account123';
  const mockPostId = 'post123';
  const mockPageToken = 'next_page_token';

  const mockCreatePostDto: CreateLinkedInPostDto = {
    content: 'Test LinkedIn post',
    visibility: 'PUBLIC',
    mediaUrls: ['https://example.com/image.jpg'],
  };

  const mockFiles = [
    {
      fieldname: 'files',
      originalname: 'test-image.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('test image content'),
      size: 1234,
    },
  ] as Express.Multer.File[];

  const mockPostResponse = {
    platformPostId: 'linkedin_post_123',
    postedAt: new Date(),
  };

  const mockCommentsResponse = {
    items: [
      {
        id: 'comment123',
        content: 'Great post!',
        authorId: 'user456',
        authorName: 'Jane Doe',
        createdAt: new Date(),
      },
    ],
    nextPageToken: 'next_page_token',
  };

  const mockPostMetrics = {
    engagement: 0.05,
    impressions: 1000,
    reach: 800,
    reactions: 50,
    comments: 10,
    shares: 5,
    platformSpecific: {
      clicks: 20,
      engagement_detail: {
        likes: 50,
        comments: 10,
        shares: 5,
        clicks: 20,
      },
    },
  };

  const mockOrganizations = [
    {
      id: 'org123',
      name: 'Test Organization',
      vanityName: 'testorg',
      description: 'A test organization',
    },
  ];

  beforeEach(async () => {
    // Create mock implementation of LinkedInService
    const mockLinkedInService = {
      post: jest.fn().mockResolvedValue(mockPostResponse),
      getComments: jest.fn().mockResolvedValue(mockCommentsResponse),
      getPostMetrics: jest.fn().mockResolvedValue(mockPostMetrics),
      getUserOrganizations: jest.fn().mockResolvedValue(mockOrganizations),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LinkedInController],
      providers: [
        {
          provide: LinkedInService,
          useValue: mockLinkedInService,
        },
      ],
    }).compile();

    controller = module.get<LinkedInController>(LinkedInController);
    linkedInService = module.get(
      LinkedInService,
    ) as jest.Mocked<LinkedInService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPost', () => {
    it('should create a post with files and media URLs', async () => {
      const result = await controller.createPost(
        mockAccountId,
        mockCreatePostDto,
        mockFiles,
      );

      // Verify the correct media items are passed to the service
      const expectedMedia: MediaItem[] = [
        { file: mockFiles[0], url: undefined },
        { url: 'https://example.com/image.jpg', file: undefined },
      ];

      expect(linkedInService.post).toHaveBeenCalledWith(
        mockAccountId,
        mockCreatePostDto,
        expectedMedia,
      );
      expect(result).toEqual(mockPostResponse);
    });

    it('should handle post creation with only media URLs (no files)', async () => {
      const result = await controller.createPost(
        mockAccountId,
        mockCreatePostDto,
        null, // No files
      );

      // Verify only URL media items are passed
      const expectedMedia: MediaItem[] = [
        { url: 'https://example.com/image.jpg', file: undefined },
      ];

      expect(linkedInService.post).toHaveBeenCalledWith(
        mockAccountId,
        mockCreatePostDto,
        expectedMedia,
      );
      expect(result).toEqual(mockPostResponse);
    });

    it('should handle post creation with only files (no media URLs)', async () => {
      // Create DTO without mediaUrls
      const dtoWithoutUrls = { ...mockCreatePostDto };
      delete dtoWithoutUrls.mediaUrls;

      const result = await controller.createPost(
        mockAccountId,
        dtoWithoutUrls,
        mockFiles,
      );

      // Verify only file media items are passed
      const expectedMedia: MediaItem[] = [
        { file: mockFiles[0], url: undefined },
      ];

      expect(linkedInService.post).toHaveBeenCalledWith(
        mockAccountId,
        dtoWithoutUrls,
        expectedMedia,
      );
      expect(result).toEqual(mockPostResponse);
    });

    it('should handle post creation with no media at all', async () => {
      // Create DTO without mediaUrls
      const dtoWithoutUrls = { ...mockCreatePostDto };
      delete dtoWithoutUrls.mediaUrls;

      const result = await controller.createPost(
        mockAccountId,
        dtoWithoutUrls,
        null, // No files
      );

      // Verify empty media array is passed
      expect(linkedInService.post).toHaveBeenCalledWith(
        mockAccountId,
        dtoWithoutUrls,
        [], // Empty media array
      );
      expect(result).toEqual(mockPostResponse);
    });

    it('should handle errors from the LinkedIn service', async () => {
      const errorMessage = 'Failed to create LinkedIn post';
      linkedInService.post.mockRejectedValueOnce(new Error(errorMessage));

      await expect(
        controller.createPost(mockAccountId, mockCreatePostDto, mockFiles),
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('getComments', () => {
    it('should get comments without page token', async () => {
      const result = await controller.getComments(mockAccountId, mockPostId);

      expect(linkedInService.getComments).toHaveBeenCalledWith(
        mockAccountId,
        mockPostId,
        undefined,
      );
      expect(result).toEqual(mockCommentsResponse);
    });

    it('should get comments with page token', async () => {
      const result = await controller.getComments(
        mockAccountId,
        mockPostId,
        mockPageToken,
      );

      expect(linkedInService.getComments).toHaveBeenCalledWith(
        mockAccountId,
        mockPostId,
        mockPageToken,
      );
      expect(result).toEqual(mockCommentsResponse);
    });

    it('should handle errors from the LinkedIn service', async () => {
      const errorMessage = 'Failed to fetch comments';
      linkedInService.getComments.mockRejectedValueOnce(
        new Error(errorMessage),
      );

      await expect(
        controller.getComments(mockAccountId, mockPostId),
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('getMetrics', () => {
    it('should get post metrics', async () => {
      const result = await controller.getMetrics(mockAccountId, mockPostId);

      expect(linkedInService.getPostMetrics).toHaveBeenCalledWith(
        mockAccountId,
        mockPostId,
      );
      expect(result).toEqual(mockPostMetrics);
    });

    it('should handle errors from the LinkedIn service', async () => {
      const errorMessage = 'Failed to fetch metrics';
      linkedInService.getPostMetrics.mockRejectedValueOnce(
        new Error(errorMessage),
      );

      await expect(
        controller.getMetrics(mockAccountId, mockPostId),
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('getUserOrganizations', () => {
    it('should get user organizations', async () => {
      const result = await controller.getUserOrganizations(mockAccountId);

      expect(linkedInService.getUserOrganizations).toHaveBeenCalledWith(
        mockAccountId,
      );
      expect(result).toEqual(mockOrganizations);
    });

    it('should handle errors from the LinkedIn service', async () => {
      const errorMessage = 'Failed to fetch organizations';
      linkedInService.getUserOrganizations.mockRejectedValueOnce(
        new Error(errorMessage),
      );

      await expect(
        controller.getUserOrganizations(mockAccountId),
      ).rejects.toThrow(errorMessage);
    });
  });
});
