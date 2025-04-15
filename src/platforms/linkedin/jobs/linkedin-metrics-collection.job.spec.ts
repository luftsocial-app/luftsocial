import { Test, TestingModule } from '@nestjs/testing';
import { LinkedInRepository } from '../repositories/linkedin.repository';
import { LinkedInService } from '../linkedin.service';
import { LinkedInMetricsCollectionJob } from './metrics-collection.job';
import { PinoLogger } from 'nestjs-pino';
import { LinkedInOrganization } from '../../../platforms/entities/linkedin-entities/linkedin-organization.entity';
import { LinkedInPost } from '../../../platforms/entities/linkedin-entities/linkedin-post.entity';
import { PostMetrics } from '../../../cross-platform/helpers/cross-platform.interface';

describe('LinkedInMetricsCollectionJob', () => {
  let job: LinkedInMetricsCollectionJob;
  let linkedInRepo: LinkedInRepository;
  let linkedInService: LinkedInService;
  // let logger: PinoLogger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkedInMetricsCollectionJob,
        {
          provide: PinoLogger,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            setContext: jest.fn(),
          },
        },

        {
          provide: LinkedInRepository,
          useFactory: () => ({
            getActiveOrganizations: jest.fn(),
            getRecentPosts: jest.fn(),
            upsertMetrics: jest.fn(),
          }),
        },
        {
          provide: LinkedInService,
          useFactory: () => ({
            getPostMetrics: jest.fn(),
          }),
        },
      ],
    }).compile();

    job = module.get<LinkedInMetricsCollectionJob>(
      LinkedInMetricsCollectionJob,
    );
    linkedInRepo = module.get<LinkedInRepository>(LinkedInRepository);
    linkedInService = module.get<LinkedInService>(LinkedInService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('collectMetrics', () => {
    it('should collect metrics for all active organizations and posts', async () => {
      // Arrange
      const mockOrganizations = [
        { id: 'org1', name: 'Organization 1' },
        { id: 'org2', name: 'Organization 2' },
      ] as unknown as LinkedInOrganization[];

      const mockPosts = [
        { id: 'post1', postId: 'linkedin-post-1' },
        { id: 'post2', postId: 'linkedin-post-2' },
      ] as unknown as LinkedInPost[];

      const mockMetrics = {
        impressions: 100,
        likes: 50,
        comments: 10,
        shares: 5,
        engagementRate: 0.65,
        collectedAt: new Date(),
      } as unknown as PostMetrics;

      // Setup repository and service mocks
      jest
        .spyOn(linkedInRepo, 'getActiveOrganizations')
        .mockResolvedValue(mockOrganizations);
      jest.spyOn(linkedInRepo, 'getRecentPosts').mockResolvedValue(mockPosts);
      jest
        .spyOn(linkedInService, 'getPostMetrics')
        .mockResolvedValue(mockMetrics);
      jest.spyOn(linkedInRepo, 'upsertMetrics').mockResolvedValue(null);

      const logger = job['logger'] as PinoLogger; // Assign the mocked logger
      const loggerSpy = jest.spyOn(logger, 'info');
      const loggerDebugSpy = jest.spyOn(logger, 'debug');

      // Act
      await job.collectMetrics();

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Starting LinkedIn metrics collection job',
      );
      expect(linkedInRepo.getActiveOrganizations).toHaveBeenCalledTimes(1);

      // Should get posts for each organization
      expect(linkedInRepo.getRecentPosts).toHaveBeenCalledTimes(2);
      expect(linkedInRepo.getRecentPosts).toHaveBeenCalledWith('org1');
      expect(linkedInRepo.getRecentPosts).toHaveBeenCalledWith('org2');

      // Should get metrics for each post
      expect(linkedInService.getPostMetrics).toHaveBeenCalledTimes(4); // 2 orgs * 2 posts
      expect(linkedInService.getPostMetrics).toHaveBeenCalledWith(
        'org1',
        'linkedin-post-1',
      );
      expect(linkedInService.getPostMetrics).toHaveBeenCalledWith(
        'org1',
        'linkedin-post-2',
      );
      expect(linkedInService.getPostMetrics).toHaveBeenCalledWith(
        'org2',
        'linkedin-post-1',
      );
      expect(linkedInService.getPostMetrics).toHaveBeenCalledWith(
        'org2',
        'linkedin-post-2',
      );

      // Should upsert metrics for each post
      expect(linkedInRepo.upsertMetrics).toHaveBeenCalledTimes(4); // 2 orgs * 2 posts
      expect(linkedInRepo.upsertMetrics).toHaveBeenCalledWith(
        'post1',
        mockMetrics,
      );
      expect(linkedInRepo.upsertMetrics).toHaveBeenCalledWith(
        'post2',
        mockMetrics,
      );

      // Should log debug message for each successful metrics collection
      expect(loggerDebugSpy).toHaveBeenCalledTimes(4); // 2 orgs * 2 posts
    });

    it('should handle errors when getting organizations and continue execution', async () => {
      // Arrange
      jest
        .spyOn(linkedInRepo, 'getActiveOrganizations')
        .mockRejectedValue(new Error('Failed to get organizations'));

      const logger = job['logger'] as PinoLogger; // Assign the mocked logger
      const loggerSpy = jest.spyOn(logger, 'info');
      const loggerErrorSpy = jest.spyOn(logger, 'error');

      // Act
      await job.collectMetrics();

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Starting LinkedIn metrics collection job',
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Metrics collection job failed',
        expect.stringContaining('Failed to get organizations'),
      );

      // Should not continue to get posts or metrics
      expect(linkedInRepo.getRecentPosts).not.toHaveBeenCalled();
      expect(linkedInService.getPostMetrics).not.toHaveBeenCalled();
      expect(linkedInRepo.upsertMetrics).not.toHaveBeenCalled();
    });

    it('should handle errors when getting posts for an organization and continue with other organizations', async () => {
      // Arrange
      const mockOrganizations = [
        { id: 'org1', name: 'Organization 1' },
        { id: 'org2', name: 'Organization 2' },
      ] as unknown as LinkedInOrganization[];

      const mockPosts = [
        { id: 'post1', postId: 'linkedin-post-1' },
        { id: 'post2', postId: 'linkedin-post-2' },
      ] as unknown as LinkedInPost[];

      const mockMetrics = {
        impressions: 100,
        likes: 50,
        comments: 10,
        shares: 5,
        engagementRate: 0.65,
        collectedAt: new Date(),
      } as unknown as PostMetrics;

      jest
        .spyOn(linkedInRepo, 'getActiveOrganizations')
        .mockResolvedValue(mockOrganizations);

      // First call (org1) throws error, second call (org2) succeeds
      jest
        .spyOn(linkedInRepo, 'getRecentPosts')
        .mockRejectedValueOnce(new Error('Failed to get posts'))
        .mockResolvedValueOnce(mockPosts);

      jest
        .spyOn(linkedInService, 'getPostMetrics')
        .mockResolvedValue(mockMetrics);
      jest.spyOn(linkedInRepo, 'upsertMetrics').mockResolvedValue(null);

      const logger = job['logger'] as PinoLogger; // Assign the mocked logger
      const loggerSpy = jest.spyOn(logger, 'info');
      const loggerErrorSpy = jest.spyOn(logger, 'error');

      // Act
      await job.collectMetrics();

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Starting LinkedIn metrics collection job',
      );
      expect(linkedInRepo.getActiveOrganizations).toHaveBeenCalledTimes(1);

      // Should try to get posts for both organizations
      expect(linkedInRepo.getRecentPosts).toHaveBeenCalledTimes(2);
      expect(linkedInRepo.getRecentPosts).toHaveBeenCalledWith('org1');
      expect(linkedInRepo.getRecentPosts).toHaveBeenCalledWith('org2');

      // Should log error for first organization
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to process organization org1',
        expect.stringContaining('Failed to get posts'),
      );

      // Should process posts for the second organization
      expect(linkedInService.getPostMetrics).toHaveBeenCalledTimes(2); // 0 for org1 + 2 for org2
      expect(linkedInRepo.upsertMetrics).toHaveBeenCalledTimes(2); // 0 for org1 + 2 for org2
    });

    it('should handle errors when getting metrics for a post and continue with other posts', async () => {
      // Arrange
      const mockOrganizations = [
        { id: 'org1', name: 'Organization 1' },
      ] as unknown as LinkedInOrganization[];

      const mockPosts = [
        { id: 'post1', postId: 'linkedin-post-1' },
        { id: 'post2', postId: 'linkedin-post-2' },
      ] as unknown as LinkedInPost[];

      const mockMetrics = {
        impressions: 100,
        likes: 50,
        comments: 10,
        shares: 5,
        engagementRate: 0.65,
        collectedAt: new Date(),
      } as unknown as PostMetrics;

      jest
        .spyOn(linkedInRepo, 'getActiveOrganizations')
        .mockResolvedValue(mockOrganizations);
      jest.spyOn(linkedInRepo, 'getRecentPosts').mockResolvedValue(mockPosts);

      // First call (post1) throws error, second call (post2) succeeds
      jest
        .spyOn(linkedInService, 'getPostMetrics')
        .mockRejectedValueOnce(new Error('Failed to get metrics'))
        .mockResolvedValueOnce(mockMetrics);

      jest.spyOn(linkedInRepo, 'upsertMetrics').mockResolvedValue(null);

      const logger = job['logger'] as PinoLogger; // Assign the mocked logger
      const loggerSpy = jest.spyOn(logger, 'info');
      const loggerErrorSpy = jest.spyOn(logger, 'error');

      // Act
      await job.collectMetrics();

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Starting LinkedIn metrics collection job',
      );
      expect(linkedInRepo.getActiveOrganizations).toHaveBeenCalledTimes(1);
      expect(linkedInRepo.getRecentPosts).toHaveBeenCalledTimes(1);

      // Should try to get metrics for both posts
      expect(linkedInService.getPostMetrics).toHaveBeenCalledTimes(2);
      expect(linkedInService.getPostMetrics).toHaveBeenCalledWith(
        'org1',
        'linkedin-post-1',
      );
      expect(linkedInService.getPostMetrics).toHaveBeenCalledWith(
        'org1',
        'linkedin-post-2',
      );

      // Should log error for first post
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to collect metrics for post linkedin-post-1',
        expect.stringContaining('Failed to get metrics'),
      );

      // Should upsert metrics only for the second post
      expect(linkedInRepo.upsertMetrics).toHaveBeenCalledTimes(1);
      expect(linkedInRepo.upsertMetrics).toHaveBeenCalledWith(
        'post2',
        mockMetrics,
      );
    });

    it('should handle errors when upserting metrics for a post and continue with other posts', async () => {
      // Arrange
      const mockOrganizations = [
        { id: 'org1', name: 'Organization 1' },
      ] as unknown as LinkedInOrganization[];

      const mockPosts = [
        { id: 'post1', postId: 'linkedin-post-1' },
        { id: 'post2', postId: 'linkedin-post-2' },
      ] as unknown as LinkedInPost[];

      const mockMetrics = {
        impressions: 100,
        likes: 50,
        comments: 10,
        shares: 5,
        engagementRate: 0.65,
        collectedAt: new Date(),
      } as unknown as PostMetrics;

      jest
        .spyOn(linkedInRepo, 'getActiveOrganizations')
        .mockResolvedValue(mockOrganizations);
      jest.spyOn(linkedInRepo, 'getRecentPosts').mockResolvedValue(mockPosts);
      jest
        .spyOn(linkedInService, 'getPostMetrics')
        .mockResolvedValue(mockMetrics);

      // First call (post1) throws error, second call (post2) succeeds
      jest
        .spyOn(linkedInRepo, 'upsertMetrics')
        .mockRejectedValueOnce(new Error('Failed to upsert metrics'))
        .mockResolvedValueOnce(null);

      const logger = job['logger'] as PinoLogger; // Assign the mocked logger
      const loggerSpy = jest.spyOn(logger, 'info');
      const loggerErrorSpy = jest.spyOn(logger, 'error');
      const loggerDebugSpy = jest.spyOn(logger, 'debug');

      // Act
      await job.collectMetrics();

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Starting LinkedIn metrics collection job',
      );

      // Should try to upsert metrics for both posts
      expect(linkedInRepo.upsertMetrics).toHaveBeenCalledTimes(2);
      expect(linkedInRepo.upsertMetrics).toHaveBeenCalledWith(
        'post1',
        mockMetrics,
      );
      expect(linkedInRepo.upsertMetrics).toHaveBeenCalledWith(
        'post2',
        mockMetrics,
      );

      // Should log error for first post
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to collect metrics for post linkedin-post-1',
        expect.stringContaining('Failed to upsert metrics'),
      );

      // Should log debug only for the second successful post
      expect(loggerDebugSpy).toHaveBeenCalledTimes(1);
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        'Collected metrics for post linkedin-post-2',
      );
    });

    it('should handle the case when no organizations are active', async () => {
      // Arrange
      jest.spyOn(linkedInRepo, 'getActiveOrganizations').mockResolvedValue([]);

      const logger = job['logger'] as PinoLogger; // Assign the mocked logger
      const loggerSpy = jest.spyOn(logger, 'info');

      // Act
      await job.collectMetrics();

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Starting LinkedIn metrics collection job',
      );
      expect(linkedInRepo.getActiveOrganizations).toHaveBeenCalledTimes(1);

      // Should not attempt to get posts or metrics
      expect(linkedInRepo.getRecentPosts).not.toHaveBeenCalled();
      expect(linkedInService.getPostMetrics).not.toHaveBeenCalled();
      expect(linkedInRepo.upsertMetrics).not.toHaveBeenCalled();
    });

    it('should handle the case when an organization has no recent posts', async () => {
      // Arrange
      const mockOrganizations = [
        { id: 'org1', name: 'Organization 1' },
      ] as unknown as LinkedInOrganization[];

      jest
        .spyOn(linkedInRepo, 'getActiveOrganizations')
        .mockResolvedValue(mockOrganizations);
      jest.spyOn(linkedInRepo, 'getRecentPosts').mockResolvedValue([]);

      const logger = job['logger'] as PinoLogger; // Assign the mocked logger
      const loggerSpy = jest.spyOn(logger, 'info');

      // Act
      await job.collectMetrics();

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Starting LinkedIn metrics collection job',
      );
      expect(linkedInRepo.getActiveOrganizations).toHaveBeenCalledTimes(1);
      expect(linkedInRepo.getRecentPosts).toHaveBeenCalledTimes(1);

      // Should not attempt to get metrics for any posts
      expect(linkedInService.getPostMetrics).not.toHaveBeenCalled();
      expect(linkedInRepo.upsertMetrics).not.toHaveBeenCalled();
    });
  });
});
