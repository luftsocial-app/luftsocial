import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { PublisherAdapterService } from './publisher-adapter.service';
import { CrossPlatformService } from '../../../cross-platform/cross-platform.service';
import { ContentPublisherService } from '../../../cross-platform/services/content-publisher.service';

describe('PublisherAdapterService', () => {
  let service: PublisherAdapterService;
  let crossPlatformService: jest.Mocked<CrossPlatformService>;
  let contentPublisherService: jest.Mocked<ContentPublisherService>;
  let logger: jest.Mocked<Logger>;

  const mockUserId = 'user-123';
  const mockContent = 'Test content for publishing';
  const mockMediaUrls = [
    'https://example.com/image1.jpg',
    'https://example.com/image2.jpg',
  ];

  const mockConnectedPlatforms = [
    { platform: 'instagram', accountId: 'ig-123' },
    { platform: 'facebook', accountId: 'fb-456' },
    { platform: 'twitter', accountId: 'tw-789' },
  ];

  const mockPlatforms = [
    { platform: 'instagram', accountId: 'ig-123' },
    { platform: 'facebook', accountId: 'fb-456' },
  ];

  const mockPublishResult = {
    publishId: 'publish-123',
    results: [
      { platform: 'instagram', success: true, postId: 'ig-post-123' },
      { platform: 'facebook', success: true, postId: 'fb-post-456' },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublisherAdapterService,
        {
          provide: CrossPlatformService,
          useValue: {
            getConnectedPlatforms: jest.fn(),
          },
        },
        {
          provide: ContentPublisherService,
          useValue: {
            publishContentWithMedia: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PublisherAdapterService>(PublisherAdapterService);
    crossPlatformService = module.get(CrossPlatformService);
    contentPublisherService = module.get(ContentPublisherService);

    // Mock the logger
    logger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    // Replace the service's logger with our mock
    (service as any).logger = logger;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validatePlatformsForUser', () => {
    it('should validate successfully when all selected platforms are connected', async () => {
      crossPlatformService.getConnectedPlatforms.mockResolvedValue(
        mockConnectedPlatforms,
      );

      await expect(
        service.validatePlatformsForUser(mockUserId, mockPlatforms),
      ).resolves.toBeUndefined();

      expect(crossPlatformService.getConnectedPlatforms).toHaveBeenCalledWith(
        mockUserId,
      );
    });

    it('should throw error when no connected platforms found', async () => {
      crossPlatformService.getConnectedPlatforms.mockResolvedValue([]);

      await expect(
        service.validatePlatformsForUser(mockUserId, mockPlatforms),
      ).rejects.toThrow(
        'No connected platforms found. Please connect at least one platform.',
      );

      expect(crossPlatformService.getConnectedPlatforms).toHaveBeenCalledWith(
        mockUserId,
      );
    });

    it('should throw error when connected platforms is null', async () => {
      crossPlatformService.getConnectedPlatforms.mockResolvedValue(null);

      await expect(
        service.validatePlatformsForUser(mockUserId, mockPlatforms),
      ).rejects.toThrow(
        'No connected platforms found. Please connect at least one platform.',
      );
    });

    it('should throw error when selected platforms are not connected', async () => {
      const limitedConnectedPlatforms = [
        { platform: 'instagram', accountId: 'ig-123' },
      ];

      crossPlatformService.getConnectedPlatforms.mockResolvedValue(
        limitedConnectedPlatforms,
      );

      const platformsWithUnconnected = [
        { platform: 'instagram', accountId: 'ig-123' },
        { platform: 'facebook', accountId: 'fb-456' },
        { platform: 'twitter', accountId: 'tw-789' },
      ];

      await expect(
        service.validatePlatformsForUser(mockUserId, platformsWithUnconnected),
      ).rejects.toThrow(
        'The following platforms are not connected: facebook, twitter. Please connect them before publishing.',
      );
    });

    it('should throw error for single unconnected platform', async () => {
      const limitedConnectedPlatforms = [
        { platform: 'instagram', accountId: 'ig-123' },
      ];

      crossPlatformService.getConnectedPlatforms.mockResolvedValue(
        limitedConnectedPlatforms,
      );

      const platformsWithOneUnconnected = [
        { platform: 'instagram', accountId: 'ig-123' },
        { platform: 'linkedin', accountId: 'li-123' },
      ];

      await expect(
        service.validatePlatformsForUser(
          mockUserId,
          platformsWithOneUnconnected,
        ),
      ).rejects.toThrow(
        'The following platforms are not connected: linkedin. Please connect them before publishing.',
      );
    });

    it('should handle service errors gracefully', async () => {
      const serviceError = new Error('Service unavailable');
      crossPlatformService.getConnectedPlatforms.mockRejectedValue(
        serviceError,
      );

      await expect(
        service.validatePlatformsForUser(mockUserId, mockPlatforms),
      ).rejects.toThrow('Service unavailable');
    });
  });

  describe('publishContent', () => {
    beforeEach(() => {
      crossPlatformService.getConnectedPlatforms.mockResolvedValue(
        mockConnectedPlatforms,
      );
      contentPublisherService.publishContentWithMedia.mockResolvedValue(
        mockPublishResult,
      );
    });

    it('should publish content successfully', async () => {
      const result = await service.publishContent(
        mockUserId,
        mockContent,
        mockPlatforms,
        mockMediaUrls,
      );

      expect(crossPlatformService.getConnectedPlatforms).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(
        contentPublisherService.publishContentWithMedia,
      ).toHaveBeenCalledWith({
        userId: mockUserId,
        content: mockContent,
        platforms: mockPlatforms,
        mediaUrls: mockMediaUrls,
      });

      expect(result).toEqual({
        success: true,
        publishId: 'publish-123',
        platformResults: mockPublishResult.results,
      });
    });

    it('should publish content without media URLs', async () => {
      const result = await service.publishContent(
        mockUserId,
        mockContent,
        mockPlatforms,
        [],
      );

      expect(
        contentPublisherService.publishContentWithMedia,
      ).toHaveBeenCalledWith({
        userId: mockUserId,
        content: mockContent,
        platforms: mockPlatforms,
        mediaUrls: [],
      });

      expect(result.success).toBe(true);
    });

    it('should handle validation errors and return failure result', async () => {
      crossPlatformService.getConnectedPlatforms.mockResolvedValue([]);

      const result = await service.publishContent(
        mockUserId,
        mockContent,
        mockPlatforms,
        mockMediaUrls,
      );

      expect(result).toEqual({
        success: false,
        error:
          'No connected platforms found. Please connect at least one platform.',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Publishing failed: No connected platforms found. Please connect at least one platform.',
        expect.any(String),
      );

      expect(
        contentPublisherService.publishContentWithMedia,
      ).not.toHaveBeenCalled();
    });

    it('should handle content publisher service errors', async () => {
      const publishError = new Error('Publishing service failed');
      contentPublisherService.publishContentWithMedia.mockRejectedValue(
        publishError,
      );

      const result = await service.publishContent(
        mockUserId,
        mockContent,
        mockPlatforms,
        mockMediaUrls,
      );

      expect(result).toEqual({
        success: false,
        error: 'Publishing service failed',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Publishing failed: Publishing service failed',
        expect.any(String),
      );
    });

    it('should handle cross-platform service errors during publishing', async () => {
      const crossPlatformError = new Error('Failed to get connected platforms');
      crossPlatformService.getConnectedPlatforms.mockRejectedValue(
        crossPlatformError,
      );

      const result = await service.publishContent(
        mockUserId,
        mockContent,
        mockPlatforms,
        mockMediaUrls,
      );

      expect(result).toEqual({
        success: false,
        error: 'Failed to get connected platforms',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Publishing failed: Failed to get connected platforms',
        expect.any(String),
      );
    });

    it('should handle empty platforms array', async () => {
      const result = await service.publishContent(
        mockUserId,
        mockContent,
        [],
        mockMediaUrls,
      );

      expect(
        contentPublisherService.publishContentWithMedia,
      ).toHaveBeenCalledWith({
        userId: mockUserId,
        content: mockContent,
        platforms: [],
        mediaUrls: mockMediaUrls,
      });

      expect(result.success).toBe(true);
    });

    it('should handle partial publishing results', async () => {
      const partialResult = {
        publishId: 'publish-456',
        results: [
          { platform: 'instagram', success: true, postId: 'ig-post-123' },
          {
            platform: 'facebook',
            success: false,
            error: 'Rate limit exceeded',
          },
        ],
      };

      contentPublisherService.publishContentWithMedia.mockResolvedValue(
        partialResult,
      );

      const result = await service.publishContent(
        mockUserId,
        mockContent,
        mockPlatforms,
        mockMediaUrls,
      );

      expect(result).toEqual({
        success: true,
        publishId: 'publish-456',
        platformResults: partialResult.results,
      });
    });

    it('should validate platforms before calling publisher service', async () => {
      const unconnectedPlatforms = [
        { platform: 'linkedin', accountId: 'li-123' },
      ];

      const result = await service.publishContent(
        mockUserId,
        mockContent,
        unconnectedPlatforms,
        mockMediaUrls,
      );

      expect(crossPlatformService.getConnectedPlatforms).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(
        contentPublisherService.publishContentWithMedia,
      ).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'The following platforms are not connected: linkedin',
      );
    });
  });

  describe('error handling and logging', () => {
    it('should log errors with proper context', async () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      crossPlatformService.getConnectedPlatforms.mockRejectedValue(error);

      await service.publishContent(
        mockUserId,
        mockContent,
        mockPlatforms,
        mockMediaUrls,
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Publishing failed: Test error',
        'Error stack trace',
      );
    });

    it('should handle errors without stack trace', async () => {
      const error = new Error('Test error without stack');
      delete error.stack;

      crossPlatformService.getConnectedPlatforms.mockRejectedValue(error);

      await service.publishContent(
        mockUserId,
        mockContent,
        mockPlatforms,
        mockMediaUrls,
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Publishing failed: Test error without stack',
        undefined,
      );
    });
  });
});
