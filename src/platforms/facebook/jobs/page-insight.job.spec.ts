import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { FacebookService } from '../facebook.service';
import { FacebookRepository } from '../repositories/facebook.repository';
import { FacebookPageInsightsJob } from './page-insight.job';

describe('FacebookPageInsightsJob', () => {
  let job: FacebookPageInsightsJob;
  let facebookRepo: FacebookRepository;
  let facebookService: FacebookService;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacebookPageInsightsJob,
        {
          provide: FacebookRepository,
          useValue: {
            getActivePages: jest.fn(),
            updatePageMetrics: jest.fn(),
          },
        },
        {
          provide: FacebookService,
          useValue: {
            getPageInsights: jest.fn(),
          },
        },
      ],
    }).compile();

    job = module.get<FacebookPageInsightsJob>(FacebookPageInsightsJob);
    facebookRepo = module.get<FacebookRepository>(FacebookRepository);
    facebookService = module.get<FacebookService>(FacebookService);

    // Spy on the logger to test error handling
    loggerSpy = jest.spyOn(Logger.prototype, 'error');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('collectPageInsights', () => {
    it('should collect insights for all active pages', async () => {
      // Mock data
      const mockPages = [
        { id: 'page1', name: 'Page 1' },
        { id: 'page2', name: 'Page 2' },
      ];
      const mockInsights1 = { followers: 100, engagement: 50 };
      const mockInsights2 = { followers: 200, engagement: 75 };

      // Setup mocks
      jest.spyOn(facebookRepo, 'getActivePages').mockResolvedValue(mockPages);
      jest
        .spyOn(facebookService, 'getPageInsights')
        .mockResolvedValueOnce(mockInsights1)
        .mockResolvedValueOnce(mockInsights2);
      jest
        .spyOn(facebookRepo, 'updatePageMetrics')
        .mockResolvedValue(undefined);

      // Execute
      await job.collectPageInsights();

      // Verify
      expect(facebookRepo.getActivePages).toHaveBeenCalledTimes(1);
      expect(facebookService.getPageInsights).toHaveBeenCalledTimes(2);
      expect(facebookService.getPageInsights).toHaveBeenCalledWith('page1');
      expect(facebookService.getPageInsights).toHaveBeenCalledWith('page2');
      expect(facebookRepo.updatePageMetrics).toHaveBeenCalledTimes(2);
      expect(facebookRepo.updatePageMetrics).toHaveBeenCalledWith(
        'page1',
        mockInsights1,
      );
      expect(facebookRepo.updatePageMetrics).toHaveBeenCalledWith(
        'page2',
        mockInsights2,
      );
      expect(loggerSpy).not.toHaveBeenCalled();
    });

    it('should handle errors for individual pages and continue processing', async () => {
      // Mock data
      const mockPages = [
        { id: 'page1', name: 'Page 1' },
        { id: 'page2', name: 'Page 2' },
      ];
      const mockInsights = { followers: 100, engagement: 50 };
      const mockError = new Error('API error');
      mockError.stack = 'Error stack trace';

      // Setup mocks
      jest.spyOn(facebookRepo, 'getActivePages').mockResolvedValue(mockPages);
      jest
        .spyOn(facebookService, 'getPageInsights')
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockInsights);
      jest
        .spyOn(facebookRepo, 'updatePageMetrics')
        .mockResolvedValue(undefined);

      // Execute
      await job.collectPageInsights();

      // Verify
      expect(facebookRepo.getActivePages).toHaveBeenCalledTimes(1);
      expect(facebookService.getPageInsights).toHaveBeenCalledTimes(2);
      expect(facebookRepo.updatePageMetrics).toHaveBeenCalledTimes(1);
      expect(facebookRepo.updatePageMetrics).toHaveBeenCalledWith(
        'page2',
        mockInsights,
      );
      expect(loggerSpy).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to collect insights for page page1',
        'Error stack trace',
      );
    });

    it('should handle error when getting active pages fails', async () => {
      // Mock error
      const mockError = new Error('Database error');
      mockError.stack = 'Error stack trace';

      // Setup mocks
      jest.spyOn(facebookRepo, 'getActivePages').mockRejectedValue(mockError);

      // Execute
      await job.collectPageInsights();

      // Verify
      expect(facebookRepo.getActivePages).toHaveBeenCalledTimes(1);
      expect(facebookService.getPageInsights).not.toHaveBeenCalled();
      expect(facebookRepo.updatePageMetrics).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith(
        'Page insights collection failed',
        'Error stack trace',
      );
    });

    it('should handle empty list of active pages', async () => {
      // Setup mocks
      jest.spyOn(facebookRepo, 'getActivePages').mockResolvedValue([]);

      // Execute
      await job.collectPageInsights();

      // Verify
      expect(facebookRepo.getActivePages).toHaveBeenCalledTimes(1);
      expect(facebookService.getPageInsights).not.toHaveBeenCalled();
      expect(facebookRepo.updatePageMetrics).not.toHaveBeenCalled();
      expect(loggerSpy).not.toHaveBeenCalled();
    });

    it('should handle error when updating page metrics fails', async () => {
      // Mock data
      const mockPages = [{ id: 'page1', name: 'Page 1' }];
      const mockInsights = { followers: 100, engagement: 50 };
      const mockError = new Error('Database update error');
      mockError.stack = 'Error stack trace';

      // Setup mocks
      jest.spyOn(facebookRepo, 'getActivePages').mockResolvedValue(mockPages);
      jest
        .spyOn(facebookService, 'getPageInsights')
        .mockResolvedValue(mockInsights);
      jest
        .spyOn(facebookRepo, 'updatePageMetrics')
        .mockRejectedValue(mockError);

      // Execute
      await job.collectPageInsights();

      // Verify
      expect(facebookRepo.getActivePages).toHaveBeenCalledTimes(1);
      expect(facebookService.getPageInsights).toHaveBeenCalledTimes(1);
      expect(facebookRepo.updatePageMetrics).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to collect insights for page page1',
        'Error stack trace',
      );
    });
  });
});
