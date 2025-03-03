import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { FacebookRepository } from '../repositories/facebook.repository';
import { FacebookService } from '../facebook.service';
import { SocialAccount } from '../../entity/social-account.entity';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import { FacebookPageMetricsJob } from './page_metrics-collection.job';
import { FacebookAccount } from '../entity/facebook-account.entity';
import { FacebookPage } from '../entity/facebook-page.entity';

describe('FacebookPageMetricsJob', () => {
  let job: FacebookPageMetricsJob;
  let facebookRepo: jest.Mocked<FacebookRepository>;
  let facebookService: jest.Mocked<FacebookService>;
  let loggerSpy: jest.SpyInstance;

  // Helper function to create a SocialAccount mock
  const createMockSocialAccount = (
    id: string,
    userId: string,
  ): SocialAccount => {
    return {
      id,
      platform: SocialPlatform.FACEBOOK,
      platformUserId: userId,
      accessToken: `access_token_${id}`,
      refreshToken: `refresh_token_${id}`,
      tokenExpiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
      tenantId: 'tenant1',
      metadata: {},
    };
  };

  // Helper function to create a FacebookAccount mock
  const createMockFacebookAccount = (
    id: string,
    socialAccount: SocialAccount,
  ): FacebookAccount => {
    return {
      id,
      socialAccount,
      facebookUserId: `fb_user_id_${id}`,
      name: `Test User ${id}`,
      email: `test${id}@example.com`,
      profileUrl: `https://facebook.com/test${id}`,
      permissions: ['email', 'pages_read_engagement'],
      pages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      tenantId: 'tenant1',
    } as FacebookAccount;
  };

  // Helper function to create a FacebookPage mock
  const createMockFacebookPage = (
    id: string,
    account: FacebookAccount | null,
  ): FacebookPage => {
    return {
      id,
      pageId: `fb_page_id_${id}`,
      name: `Test Page ${id}`,
      category: id === '2' ? 'Entertainment' : id === '3' ? 'News' : 'Business',
      about: `About page ${id}`,
      description: `Description for page ${id}`,
      accessToken: `token${id}`,
      permissions: ['manage_pages', 'read_insights'],
      followerCount: parseInt(id) * 1000,
      metadata: { verified: true },
      facebookAccount: account,
      posts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      tenantId: 'tenant1',
    } as FacebookPage;
  };

  // Define interfaces for type-safety in tests
  type MockedFacebookRepository = {
    getActivePages: jest.Mock<Promise<FacebookPage[]>>;
    upsertPageMetrics: jest.Mock;
  };

  beforeEach(async () => {
    const mockFacebookRepo: MockedFacebookRepository = {
      getActivePages: jest.fn<Promise<FacebookPage[]>, []>(),
      upsertPageMetrics: jest.fn(),
    };

    const mockFacebookService = {
      getPageInsights: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacebookPageMetricsJob,
        { provide: FacebookRepository, useValue: mockFacebookRepo },
        { provide: FacebookService, useValue: mockFacebookService },
      ],
    }).compile();

    job = module.get<FacebookPageMetricsJob>(FacebookPageMetricsJob);
    facebookRepo = module.get(
      FacebookRepository,
    ) as unknown as jest.Mocked<FacebookRepository>;
    facebookService = module.get(
      FacebookService,
    ) as jest.Mocked<FacebookService>;

    // Spy on Logger methods
    loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('collectPageMetrics', () => {
    it('should process all active pages with accounts', async () => {
      // Arrange
      // Create mock accounts and pages using helper functions
      const socialAccount1 = createMockSocialAccount('social1', 'fb_user_id_1');
      const socialAccount2 = createMockSocialAccount('social2', 'fb_user_id_2');

      const facebookAccount1 = createMockFacebookAccount(
        'account1',
        socialAccount1,
      );
      const facebookAccount2 = createMockFacebookAccount(
        'account2',
        socialAccount2,
      );

      const mockPages = [
        createMockFacebookPage('1', facebookAccount1),
        createMockFacebookPage('2', facebookAccount2),
      ];
      facebookRepo.getActivePages.mockResolvedValue(mockPages);

      const mockMetrics1 = { likes: 100, shares: 50 };
      const mockMetrics2 = { likes: 200, shares: 75 };

      facebookService.getPageInsights
        .mockResolvedValueOnce(mockMetrics1)
        .mockResolvedValueOnce(mockMetrics2);

      // Act
      await job.collectPageMetrics();

      // Assert
      expect(facebookRepo.getActivePages).toHaveBeenCalledTimes(1);
      expect(facebookService.getPageInsights).toHaveBeenCalledTimes(2);
      expect(facebookService.getPageInsights).toHaveBeenNthCalledWith(
        1,
        'account1',
      );
      expect(facebookService.getPageInsights).toHaveBeenNthCalledWith(
        2,
        'account2',
      );

      expect(facebookRepo.upsertPageMetrics).toHaveBeenCalledTimes(2);
      expect(facebookRepo.upsertPageMetrics).toHaveBeenNthCalledWith(1, {
        pageId: '1',
        ...mockMetrics1,
      });
      expect(facebookRepo.upsertPageMetrics).toHaveBeenNthCalledWith(2, {
        pageId: '2',
        ...mockMetrics2,
      });

      expect(loggerSpy).not.toHaveBeenCalled();
    });

    it('should skip pages with no associated account', async () => {
      // Arrange
      // Create mock account using helper function
      const socialAccount1 = createMockSocialAccount('social1', 'fb_user_id_1');
      const facebookAccount1 = createMockFacebookAccount(
        'account1',
        socialAccount1,
      );

      const mockPages = [
        createMockFacebookPage('1', facebookAccount1),
        createMockFacebookPage('2', null),
        createMockFacebookPage('3', undefined),
      ];
      facebookRepo.getActivePages.mockResolvedValue(mockPages);

      const mockMetrics = { likes: 100, shares: 50 };
      facebookService.getPageInsights.mockResolvedValue(mockMetrics);

      const warnSpy = jest.spyOn(Logger.prototype, 'warn');

      // Act
      await job.collectPageMetrics();

      // Assert
      expect(facebookRepo.getActivePages).toHaveBeenCalledTimes(1);
      expect(facebookService.getPageInsights).toHaveBeenCalledTimes(1);
      expect(facebookService.getPageInsights).toHaveBeenCalledWith('account1');

      expect(facebookRepo.upsertPageMetrics).toHaveBeenCalledTimes(1);
      expect(facebookRepo.upsertPageMetrics).toHaveBeenCalledWith({
        pageId: '1',
        ...mockMetrics,
      });

      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenNthCalledWith(
        1,
        'Skipping page 2 as it has no associated account.',
      );
      expect(warnSpy).toHaveBeenNthCalledWith(
        2,
        'Skipping page 3 as it has no associated account.',
      );
    });

    it('should handle errors when fetching metrics for a specific page', async () => {
      // Arrange
      // Create mock accounts using helper functions
      const socialAccount1 = createMockSocialAccount('social1', 'fb_user_id_1');
      const socialAccount2 = createMockSocialAccount('social2', 'fb_user_id_2');

      const facebookAccount1 = createMockFacebookAccount(
        'account1',
        socialAccount1,
      );
      const facebookAccount2 = createMockFacebookAccount(
        'account2',
        socialAccount2,
      );

      const mockPages = [
        createMockFacebookPage('1', facebookAccount1),
        createMockFacebookPage('2', facebookAccount2),
      ];
      facebookRepo.getActivePages.mockResolvedValue(mockPages);

      const mockMetrics = { likes: 100, shares: 50 };
      const mockError = new Error('API error');

      facebookService.getPageInsights
        .mockResolvedValueOnce(mockMetrics)
        .mockRejectedValueOnce(mockError);

      // Act
      await job.collectPageMetrics();

      // Assert
      expect(facebookRepo.getActivePages).toHaveBeenCalledTimes(1);
      expect(facebookService.getPageInsights).toHaveBeenCalledTimes(2);

      expect(facebookRepo.upsertPageMetrics).toHaveBeenCalledTimes(1);
      expect(facebookRepo.upsertPageMetrics).toHaveBeenCalledWith({
        pageId: '1',
        ...mockMetrics,
      });

      expect(loggerSpy).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to collect metrics for page 2',
        mockError.stack,
      );
    });

    it('should handle errors when fetching active pages', async () => {
      // Arrange
      const mockError = new Error('Database error');
      facebookRepo.getActivePages.mockRejectedValue(mockError);

      // Act
      await job.collectPageMetrics();

      // Assert
      expect(facebookRepo.getActivePages).toHaveBeenCalledTimes(1);
      expect(facebookService.getPageInsights).not.toHaveBeenCalled();
      expect(facebookRepo.upsertPageMetrics).not.toHaveBeenCalled();

      expect(loggerSpy).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith(
        'Page metrics collection job failed',
        mockError.stack,
      );
    });

    it('should handle empty list of active pages', async () => {
      // Arrange
      facebookRepo.getActivePages.mockResolvedValue([]);

      // Act
      await job.collectPageMetrics();

      // Assert
      expect(facebookRepo.getActivePages).toHaveBeenCalledTimes(1);
      expect(facebookService.getPageInsights).not.toHaveBeenCalled();
      expect(facebookRepo.upsertPageMetrics).not.toHaveBeenCalled();
      expect(loggerSpy).not.toHaveBeenCalled();
    });

    it('should handle errors during page metrics upsert', async () => {
      // Arrange
      // Create mock account using helper function
      const socialAccount1 = createMockSocialAccount('social1', 'fb_user_id_1');
      const facebookAccount1 = createMockFacebookAccount(
        'account1',
        socialAccount1,
      );

      const mockPages = [createMockFacebookPage('1', facebookAccount1)];
      facebookRepo.getActivePages.mockResolvedValue(mockPages);

      const mockMetrics = { likes: 100, shares: 50 };
      facebookService.getPageInsights.mockResolvedValue(mockMetrics);

      const mockError = new Error('Database write error');
      facebookRepo.upsertPageMetrics.mockRejectedValue(mockError);

      // Act
      await job.collectPageMetrics();

      // Assert
      expect(facebookRepo.getActivePages).toHaveBeenCalledTimes(1);
      expect(facebookService.getPageInsights).toHaveBeenCalledTimes(1);
      expect(facebookRepo.upsertPageMetrics).toHaveBeenCalledTimes(1);

      expect(loggerSpy).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to collect metrics for page 1',
        mockError.stack,
      );
    });

    it('should continue processing remaining pages after an error', async () => {
      // Arrange
      // Create mock accounts and pages using helper functions
      const socialAccount1 = createMockSocialAccount('social1', 'fb_user_id_1');
      const socialAccount2 = createMockSocialAccount('social2', 'fb_user_id_2');

      const facebookAccount1 = createMockFacebookAccount(
        'account1',
        socialAccount1,
      );
      const facebookAccount2 = createMockFacebookAccount(
        'account2',
        socialAccount2,
      );

      const mockPages = [
        {
          id: '1',
          pageId: 'fb_page_id_1',
          name: 'Test Page 1',
          category: 'Business',
          about: 'About page 1',
          description: 'Description for page 1',
          accessToken: 'token1',
          permissions: ['manage_pages', 'read_insights'],
          followerCount: 1000,
          metadata: { verified: true },
          facebookAccount: facebookAccount1,
          posts: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          tenantId: 'tenant1',
        },
        {
          id: '2',
          pageId: 'fb_page_id_2',
          name: 'Test Page 2',
          category: 'Entertainment',
          about: 'About page 2',
          description: 'Description for page 2',
          accessToken: 'token2',
          permissions: ['manage_pages', 'read_insights'],
          followerCount: 2000,
          metadata: { verified: true },
          facebookAccount: { id: 'account2' },
          posts: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          tenantId: 'tenant1',
        },
        {
          id: '3',
          pageId: 'fb_page_id_3',
          name: 'Test Page 3',
          category: 'News',
          about: 'About page 3',
          description: 'Description for page 3',
          accessToken: 'token3',
          permissions: ['manage_pages', 'read_insights'],
          followerCount: 3000,
          metadata: { verified: true },
          facebookAccount: facebookAccount2,
          posts: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          tenantId: 'tenant1',
        },
      ];
      facebookRepo.getActivePages.mockResolvedValue(mockPages);

      const mockMetrics1 = { likes: 100, shares: 50 };
      const mockMetrics3 = { likes: 300, shares: 150 };
      const mockError = new Error('API error for page2');

      facebookService.getPageInsights
        .mockResolvedValueOnce(mockMetrics1)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockMetrics3);

      // Act
      await job.collectPageMetrics();

      // Assert
      expect(facebookService.getPageInsights).toHaveBeenCalledTimes(3);
      expect(facebookRepo.upsertPageMetrics).toHaveBeenCalledTimes(2);
      expect(facebookRepo.upsertPageMetrics).toHaveBeenNthCalledWith(1, {
        pageId: '1',
        ...mockMetrics1,
      });
      expect(facebookRepo.upsertPageMetrics).toHaveBeenNthCalledWith(2, {
        pageId: '3',
        ...mockMetrics3,
      });

      expect(loggerSpy).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to collect metrics for page 2',
        mockError.stack,
      );
    });
  });
});
