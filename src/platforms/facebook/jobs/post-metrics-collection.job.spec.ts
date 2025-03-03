import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { FacebookRepository } from '../repositories/facebook.repository';
import { FacebookService } from '../facebook.service';
import { FacebookPostMetricsJob } from './post-metrics-collection.job';

describe('FacebookPostMetricsJob', () => {
  let job: FacebookPostMetricsJob;
  let facebookRepo: FacebookRepository;
  let facebookService: FacebookService;
  let loggerErrorSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;
  let loggerDebugSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacebookPostMetricsJob,
        {
          provide: FacebookRepository,
          useValue: {
            getRecentPosts: jest.fn(),
            upsertPostMetrics: jest.fn(),
          },
        },
        {
          provide: FacebookService,
          useValue: {
            getPostMetrics: jest.fn(),
          },
        },
      ],
    }).compile();

    job = module.get<FacebookPostMetricsJob>(FacebookPostMetricsJob);
    facebookRepo = module.get<FacebookRepository>(FacebookRepository);
    facebookService = module.get<FacebookService>(FacebookService);

    // Spy on logger methods to test different logging scenarios
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error');
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn');
    loggerDebugSpy = jest.spyOn(Logger.prototype, 'debug');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('collectPostMetrics', () => {
    it('should collect metrics for all recent posts with accounts', async () => {
      // Mock data
      const mockPosts = [
        { id: 'post1', account: { id: 'account1' } },
        { id: 'post2', account: { id: 'account2' } },
      ];
      const mockMetrics1 = { likes: 100, shares: 50, comments: 25 };
      const mockMetrics2 = { likes: 200, shares: 75, comments: 30 };

      // Setup mocks
      jest.spyOn(facebookRepo, 'getRecentPosts').mockResolvedValue(mockPosts);
      jest
        .spyOn(facebookService, 'getPostMetrics')
        .mockResolvedValueOnce(mockMetrics1)
        .mockResolvedValueOnce(mockMetrics2);
      jest
        .spyOn(facebookRepo, 'upsertPostMetrics')
        .mockResolvedValue(undefined);

      // Execute
      await job.collectPostMetrics();

      // Verify
      expect(facebookRepo.getRecentPosts).toHaveBeenCalledTimes(1);
      expect(facebookService.getPostMetrics).toHaveBeenCalledTimes(2);
      expect(facebookService.getPostMetrics).toHaveBeenCalledWith(
        'account1',
        'post1',
      );
      expect(facebookService.getPostMetrics).toHaveBeenCalledWith(
        'account2',
        'post2',
      );
      expect(facebookRepo.upsertPostMetrics).toHaveBeenCalledTimes(2);
      expect(facebookRepo.upsertPostMetrics).toHaveBeenCalledWith({
        postId: 'post1',
        metrics: mockMetrics1,
      });
      expect(facebookRepo.upsertPostMetrics).toHaveBeenCalledWith({
        postId: 'post2',
        metrics: mockMetrics2,
      });
      expect(loggerErrorSpy).not.toHaveBeenCalled();
      expect(loggerWarnSpy).not.toHaveBeenCalled();
      expect(loggerDebugSpy).toHaveBeenCalledTimes(2);
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        'Collected metrics for post post1',
      );
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        'Collected metrics for post post2',
      );
    });

    it('should skip posts without associated accounts', async () => {
      // Mock data
      const mockPosts = [
        { id: 'post1', account: { id: 'account1' } },
        { id: 'post2', account: null },
        { id: 'post3', account: undefined },
      ];
      const mockMetrics = { likes: 100, shares: 50, comments: 25 };

      // Setup mocks
      jest.spyOn(facebookRepo, 'getRecentPosts').mockResolvedValue(mockPosts);
      jest
        .spyOn(facebookService, 'getPostMetrics')
        .mockResolvedValue(mockMetrics);
      jest
        .spyOn(facebookRepo, 'upsertPostMetrics')
        .mockResolvedValue(undefined);

      // Execute
      await job.collectPostMetrics();

      // Verify
      expect(facebookRepo.getRecentPosts).toHaveBeenCalledTimes(1);
      expect(facebookService.getPostMetrics).toHaveBeenCalledTimes(1);
      expect(facebookService.getPostMetrics).toHaveBeenCalledWith(
        'account1',
        'post1',
      );
      expect(facebookRepo.upsertPostMetrics).toHaveBeenCalledTimes(1);
      expect(loggerWarnSpy).toHaveBeenCalledTimes(2);
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Skipping post post2 as it has no associated account.',
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Skipping post post3 as it has no associated account.',
      );
    });

    it('should handle errors for individual posts and continue processing', async () => {
      // Mock data
      const mockPosts = [
        { id: 'post1', account: { id: 'account1' } },
        { id: 'post2', account: { id: 'account2' } },
        { id: 'post3', account: { id: 'account3' } },
      ];
      const mockMetrics = { likes: 100, shares: 50, comments: 25 };
      const mockError = new Error('API error');
      mockError.stack = 'Error stack trace';

      // Setup mocks
      jest.spyOn(facebookRepo, 'getRecentPosts').mockResolvedValue(mockPosts);
      jest
        .spyOn(facebookService, 'getPostMetrics')
        .mockResolvedValueOnce(mockMetrics)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockMetrics);

      jest
        .spyOn(facebookRepo, 'upsertPostMetrics')
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      // Execute
      await job.collectPostMetrics();

      // Verify
      expect(facebookRepo.getRecentPosts).toHaveBeenCalledTimes(1);
      expect(facebookService.getPostMetrics).toHaveBeenCalledTimes(3);
      expect(facebookRepo.upsertPostMetrics).toHaveBeenCalledTimes(2);
      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to collect metrics for post post2',
        'Error stack trace',
      );
      expect(loggerDebugSpy).toHaveBeenCalledTimes(2);
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        'Collected metrics for post post1',
      );
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        'Collected metrics for post post3',
      );
    });

    it('should handle error when updating post metrics fails', async () => {
      // Mock data
      const mockPosts = [
        { id: 'post1', account: { id: 'account1' } },
        { id: 'post2', account: { id: 'account2' } },
      ];
      const mockMetrics = { likes: 100, shares: 50, comments: 25 };
      const mockError = new Error('Database update error');
      mockError.stack = 'Error stack trace';

      // Setup mocks
      jest.spyOn(facebookRepo, 'getRecentPosts').mockResolvedValue(mockPosts);
      jest
        .spyOn(facebookService, 'getPostMetrics')
        .mockResolvedValue(mockMetrics);
      jest
        .spyOn(facebookRepo, 'upsertPostMetrics')
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(mockError);

      // Execute
      await job.collectPostMetrics();

      // Verify
      expect(facebookRepo.getRecentPosts).toHaveBeenCalledTimes(1);
      expect(facebookService.getPostMetrics).toHaveBeenCalledTimes(2);
      expect(facebookRepo.upsertPostMetrics).toHaveBeenCalledTimes(2);
      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to collect metrics for post post2',
        'Error stack trace',
      );
      expect(loggerDebugSpy).toHaveBeenCalledTimes(1);
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        'Collected metrics for post post1',
      );
    });

    it('should handle error when getting recent posts fails', async () => {
      // Mock error
      const mockError = new Error('Database error');
      mockError.stack = 'Error stack trace';

      // Setup mocks
      jest.spyOn(facebookRepo, 'getRecentPosts').mockRejectedValue(mockError);

      // Execute
      await job.collectPostMetrics();

      // Verify
      expect(facebookRepo.getRecentPosts).toHaveBeenCalledTimes(1);
      expect(facebookService.getPostMetrics).not.toHaveBeenCalled();
      expect(facebookRepo.upsertPostMetrics).not.toHaveBeenCalled();
      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Post metrics collection job failed',
        'Error stack trace',
      );
    });

    it('should handle empty list of recent posts', async () => {
      // Setup mocks
      jest.spyOn(facebookRepo, 'getRecentPosts').mockResolvedValue([]);

      // Execute
      await job.collectPostMetrics();

      // Verify
      expect(facebookRepo.getRecentPosts).toHaveBeenCalledTimes(1);
      expect(facebookService.getPostMetrics).not.toHaveBeenCalled();
      expect(facebookRepo.upsertPostMetrics).not.toHaveBeenCalled();
      expect(loggerErrorSpy).not.toHaveBeenCalled();
      expect(loggerWarnSpy).not.toHaveBeenCalled();
      expect(loggerDebugSpy).not.toHaveBeenCalled();
    });
  });
});
