import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, EntityManager, MoreThan, LessThan } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { FacebookRepository } from './facebook.repository';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import { SocialAccount } from '../../../entities/notifications/entity/social-account.entity';
import { AuthState } from '../../../entities/socials/facebook-entities/auth-state.entity';
import { FacebookAccount } from '../../../entities/socials/facebook-entities/facebook-account.entity';
import { FacebookPageMetric } from '../../../entities/socials/facebook-entities/facebook-page-metric.entity';
import { FacebookPage } from '../../../entities/socials/facebook-entities/facebook-page.entity';
import { FacebookPostMetric } from '../../../entities/socials/facebook-entities/facebook-post-metric.entity';
import { FacebookPost } from '../../../entities/socials/facebook-entities/facebook-post.entity';


//TODO: FIX TESTS

// Mock crypto module
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('mocked-random-state'),
  }),
}));

describe('FacebookRepository', () => {
  let repository: FacebookRepository;
  let accountRepo: Repository<FacebookAccount>;
  let authStateRepo: Repository<AuthState>;
  let pageRepo: Repository<FacebookPage>;
  let postRepo: Repository<FacebookPost>;
  let metricRepo: Repository<FacebookPostMetric>;
  let pageMetricRepo: Repository<FacebookPageMetric>;
  let entityManager: EntityManager;

  const mockTenantId = 'test-tenant-id';

  // Mock data
  const mockAccountData: Partial<FacebookAccount> = {
    id: 'fb-account-id',
    name: 'Test Account',
    accessToken: 'test-access-token',
    userId: 'test-user-id',
    socialAccount: {
      id: 'social-account-id',
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      tokenExpiresAt: new Date(Date.now() + 3600000),
      platform: SocialPlatform.FACEBOOK,
    } as SocialAccount,
  };

  const mockPageData: Partial<FacebookPage> = {
    id: 'fb-page-id',
    name: 'Test Page',
    accessToken: 'test-page-token',
    pageId: 'external-page-id',
    facebookAccount: mockAccountData as FacebookAccount,
  };

  const mockPostData: Partial<FacebookPost> = {
    id: 'fb-post-id',
    postId: 'external-post-id',
    message: 'Test post message',
    page: mockPageData as FacebookPage,
    account: mockAccountData as FacebookAccount,
    isPublished: true,
    metrics: [],
  };

  const mockMetricData: Partial<FacebookPostMetric> = {
    id: 'fb-metric-id',
    post: mockPostData as FacebookPost,
    likes: 10,
    comments: 5,
    shares: 2,
    reach: 1000,
    impressions: 1500,
    collectedAt: new Date(),
  };

  const mockPageMetricData: Partial<FacebookPageMetric> = {
    id: 'fb-page-metric-id',
    page: mockPageData as FacebookPage,
    impressions: 5000,
    engagedUsers: 200,
    newFans: 20,
    pageViews: 500,
    engagements: 300,
    followers: 1000,
    collectedAt: new Date(),
  };

  // Mocks for each repository
  const mockAccountRepo = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
  };

  const mockAuthStateRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockPageRepo = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockPostRepo = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
  };

  const mockMetricRepo = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockPageMetricRepo = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockEntityManager = {
    update: jest.fn(),
    transaction: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacebookRepository,
        {
          provide: getRepositoryToken(FacebookAccount),
          useValue: mockAccountRepo,
        },
        {
          provide: getRepositoryToken(AuthState),
          useValue: mockAuthStateRepo,
        },
        {
          provide: getRepositoryToken(FacebookPage),
          useValue: mockPageRepo,
        },
        {
          provide: getRepositoryToken(FacebookPost),
          useValue: mockPostRepo,
        },
        {
          provide: getRepositoryToken(FacebookPostMetric),
          useValue: mockMetricRepo,
        },
        {
          provide: getRepositoryToken(FacebookPageMetric),
          useValue: mockPageMetricRepo,
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
      ],
    }).compile();

    repository = module.get<FacebookRepository>(FacebookRepository);
    accountRepo = module.get<Repository<FacebookAccount>>(
      getRepositoryToken(FacebookAccount),
    );
    authStateRepo = module.get<Repository<AuthState>>(
      getRepositoryToken(AuthState),
    );
    pageRepo = module.get<Repository<FacebookPage>>(
      getRepositoryToken(FacebookPage),
    );
    postRepo = module.get<Repository<FacebookPost>>(
      getRepositoryToken(FacebookPost),
    );
    metricRepo = module.get<Repository<FacebookPostMetric>>(
      getRepositoryToken(FacebookPostMetric),
    );
    pageMetricRepo = module.get<Repository<FacebookPageMetric>>(
      getRepositoryToken(FacebookPageMetric),
    );
    entityManager = module.get<EntityManager>(EntityManager);

    // Mock the getTenantId method
    jest.spyOn(repository as any, 'getTenantId').mockReturnValue(mockTenantId);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  // Test suite for createAccount method
  describe('createAccount', () => {
    it('should create a new Facebook account', async () => {
      // Arrange
      mockAccountRepo.create.mockReturnValue(mockAccountData);
      mockAccountRepo.save.mockResolvedValue(mockAccountData);

      // Act
      const result = await repository.createAccount(mockAccountData);

      // Assert
      expect(mockAccountRepo.create).toHaveBeenCalledWith(mockAccountData);
      expect(mockAccountRepo.save).toHaveBeenCalledWith(mockAccountData);
      expect(result).toEqual(mockAccountData);
    });
  });

  // Test suite for createAuthState method
  describe('createAuthState', () => {
    it('should create an auth state for a user', async () => {
      // Arrange
      const userId = 'test-user-id';
      const expectedState = 'mocked-random-state';

      mockAuthStateRepo.create.mockImplementation((data) => data);
      mockAuthStateRepo.save.mockResolvedValue({ state: expectedState });

      // Act
      const result = await repository.createAuthState(userId);

      // Assert
      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      expect(mockAuthStateRepo.create).toHaveBeenCalledWith({
        state: expectedState,
        userId,
        platform: SocialPlatform.FACEBOOK,
        expiresAt: expect.any(Date),
      });
      expect(mockAuthStateRepo.save).toHaveBeenCalled();
      expect(result).toEqual(expectedState);
    });
  });

  // Test suite for updateAccount method
  describe('updateAccount', () => {
    it('should update an existing Facebook account', async () => {
      // Arrange
      const id = 'fb-account-id';
      const updateData = { name: 'Updated Account Name' };
      const updatedAccount = { ...mockAccountData, ...updateData };

      mockAccountRepo.update.mockResolvedValue({ affected: 1 });
      mockAccountRepo.findOne.mockResolvedValue(updatedAccount);

      // Act
      const result = await repository.updateAccount(id, updateData);

      // Assert
      expect(mockAccountRepo.update).toHaveBeenCalledWith(id, updateData);
      expect(mockAccountRepo.findOne).toHaveBeenCalledWith({
        where: { id, tenantId: mockTenantId },
      });
      expect(result).toEqual(updatedAccount);
    });
  });

  // Test suite for createPage method
  describe('createPage', () => {
    it('should create a new Facebook page', async () => {
      // Arrange
      mockPageRepo.create.mockReturnValue(mockPageData);
      mockPageRepo.save.mockResolvedValue(mockPageData);

      // Act
      const result = await repository.createPage(mockPageData);

      // Assert
      expect(mockPageRepo.create).toHaveBeenCalledWith(mockPageData);
      expect(mockPageRepo.save).toHaveBeenCalledWith(mockPageData);
      expect(result).toEqual(mockPageData);
    });
  });

  // Test suite for createPost method
  describe('createPost', () => {
    it('should create a new Facebook post', async () => {
      // Arrange
      mockPostRepo.create.mockReturnValue(mockPostData);
      mockPostRepo.save.mockResolvedValue(mockPostData);

      // Act
      const result = await repository.createPost(mockPostData);

      // Assert
      expect(mockPostRepo.create).toHaveBeenCalledWith(mockPostData);
      expect(mockPostRepo.save).toHaveBeenCalledWith(mockPostData);
      expect(result).toEqual(mockPostData);
    });
  });

  // Test suite for getAccountById method
  describe('getAccountById', () => {
    it('should return a Facebook account by ID', async () => {
      // Arrange
      mockAccountRepo.findOne.mockResolvedValue(mockAccountData);

      // Act
      const result = await repository.getAccountById('fb-account-id');

      // Assert
      expect(mockAccountRepo.findOne).toHaveBeenCalledWith({
        where: {
          id: 'fb-account-id',
          tenantId: mockTenantId,
        },
        relations: ['socialAccount'],
      });
      expect(result).toEqual(mockAccountData);
    });

    it('should return null when account does not exist', async () => {
      // Arrange
      mockAccountRepo.findOne.mockResolvedValue(null);

      // Act
      const result = await repository.getAccountById('non-existent-id');

      // Assert
      expect(result).toBeNull();
    });
  });

  // Test suite for getPageById method
  describe('getPageById', () => {
    it('should return a Facebook page by ID', async () => {
      // Arrange
      mockPageRepo.findOne.mockResolvedValue(mockPageData);

      // Act
      const result = await repository.getPageById('fb-page-id');

      // Assert
      expect(mockPageRepo.findOne).toHaveBeenCalledWith({
        where: {
          id: 'fb-page-id',
          tenantId: mockTenantId,
        },
        relations: [],
      });
      expect(result).toEqual(mockPageData);
    });

    it('should include specified relations when fetching a page', async () => {
      // Arrange
      mockPageRepo.findOne.mockResolvedValue(mockPageData);
      const relations = ['facebookAccount', 'posts'];

      // Act
      const result = await repository.getPageById('fb-page-id', relations);

      // Assert
      expect(mockPageRepo.findOne).toHaveBeenCalledWith({
        where: {
          id: 'fb-page-id',
          tenantId: mockTenantId,
        },
        relations,
      });
      expect(result).toEqual(mockPageData);
    });
  });

  // Test suite for getPostById method
  describe('getPostById', () => {
    it('should return a Facebook post by ID', async () => {
      // Arrange
      mockPostRepo.findOne.mockResolvedValue(mockPostData);

      // Act
      const result = await repository.getPostById('fb-post-id');

      // Assert
      expect(mockPostRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'fb-post-id', tenantId: mockTenantId },
        relations: [],
      });
      expect(result).toEqual(mockPostData);
    });

    it('should include specified relations when fetching a post', async () => {
      // Arrange
      mockPostRepo.findOne.mockResolvedValue(mockPostData);
      const relations = ['page', 'metrics'];

      // Act
      const result = await repository.getPostById('fb-post-id', relations);

      // Assert
      expect(mockPostRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'fb-post-id', tenantId: mockTenantId },
        relations,
      });
      expect(result).toEqual(mockPostData);
    });
  });

  // Test suite for getRecentPosts method
  describe('getRecentPosts', () => {
    it('should return recent posts within the specified timeframe', async () => {
      // Arrange
      const recentPosts = [
        mockPostData,
        { ...mockPostData, id: 'fb-post-id-2' },
      ];
      mockPostRepo.find.mockResolvedValue(recentPosts);

      // Act
      const result = await repository.getRecentPosts(24);

      // Assert
      expect(mockPostRepo.find).toHaveBeenCalledWith({
        where: {
          createdAt: MoreThan(expect.any(Date)),
          isPublished: true,
          tenantId: mockTenantId,
        },
        relations: ['account'],
        order: {
          createdAt: 'DESC',
        },
      });
      expect(result).toEqual(recentPosts);
    });

    it('should use default timeframe of 24 hours if not specified', async () => {
      // Arrange
      mockPostRepo.find.mockResolvedValue([mockPostData]);

      // Act
      await repository.getRecentPosts();

      // Assert
      expect(mockPostRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: MoreThan(expect.any(Date)),
          }),
        }),
      );
    });
  });

  // Test suite for getAccountPages method
  describe('getAccountPages', () => {
    it('should return pages associated with a Facebook account', async () => {
      // Arrange
      const pages = [mockPageData, { ...mockPageData, id: 'fb-page-id-2' }];
      mockPageRepo.find.mockResolvedValue(pages);

      // Act
      const result = await repository.getAccountPages('fb-account-id');

      // Assert
      expect(mockPageRepo.find).toHaveBeenCalledWith({
        where: {
          facebookAccount: { id: 'fb-account-id' },
          tenantId: mockTenantId,
        },
      });
      expect(result).toEqual(pages);
    });
  });

  // Test suite for updateAccountTokens method
  describe('updateAccountTokens', () => {
    it('should update account tokens successfully', async () => {
      // Arrange
      const accountId = 'fb-account-id';
      const tokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockAccountRepo.findOne.mockResolvedValue(mockAccountData);
      mockEntityManager.update.mockResolvedValue({ affected: 1 });
      mockAccountRepo.findOne
        .mockResolvedValueOnce(mockAccountData)
        .mockResolvedValueOnce({
          ...mockAccountData,
          socialAccount: {
            ...mockAccountData.socialAccount,
            accessToken: tokens.accessToken,
          },
        });

      // Act
      const result = await repository.updateAccountTokens(accountId, tokens);

      // Assert
      expect(mockAccountRepo.findOne).toHaveBeenCalledWith({
        where: { id: accountId, tenantId: mockTenantId },
        relations: ['socialAccount'],
      });
      expect(mockEntityManager.update).toHaveBeenCalledWith(
        SocialAccount,
        mockAccountData.socialAccount.id,
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          updatedAt: expect.any(Date),
        },
      );
      expect(result).toEqual(expect.objectContaining({ id: accountId }));
    });

    it('should throw NotFoundException when account not found', async () => {
      // Arrange
      const accountId = 'non-existent-id';
      const tokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockAccountRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        repository.updateAccountTokens(accountId, tokens),
      ).rejects.toThrow(NotFoundException);
      expect(mockEntityManager.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when social account is missing', async () => {
      // Arrange
      const accountId = 'fb-account-id';
      const tokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
      };

      const accountWithoutSocialAccount = {
        ...mockAccountData,
        socialAccount: null,
      };
      mockAccountRepo.findOne.mockResolvedValue(accountWithoutSocialAccount);

      // Act & Assert
      await expect(
        repository.updateAccountTokens(accountId, tokens),
      ).rejects.toThrow(NotFoundException);
      expect(mockEntityManager.update).not.toHaveBeenCalled();
    });
  });

  // Test suite for getPagePosts method
  describe('getPagePosts', () => {
    it('should return posts for a specific page', async () => {
      // Arrange
      const pageId = 'fb-page-id';
      const posts = [mockPostData, { ...mockPostData, id: 'fb-post-id-2' }];
      mockPostRepo.find.mockResolvedValue(posts);

      // Act
      const result = await repository.getPagePosts(pageId);

      // Assert
      expect(mockPostRepo.find).toHaveBeenCalledWith({
        where: { page: { id: pageId }, tenantId: mockTenantId },
        order: { createdAt: 'DESC' },
        take: 10,
        relations: ['metrics'],
      });
      expect(result).toEqual(posts);
    });

    it('should respect the limit parameter', async () => {
      // Arrange
      const pageId = 'fb-page-id';
      const limit = 5;
      mockPostRepo.find.mockResolvedValue([mockPostData]);

      // Act
      await repository.getPagePosts(pageId, limit);

      // Assert
      expect(mockPostRepo.find).toHaveBeenCalledWith({
        where: { page: { id: pageId }, tenantId: mockTenantId },
        order: { createdAt: 'DESC' },
        take: limit,
        relations: ['metrics'],
      });
    });
  });

  // Test suite for getRecentPostCount method
  describe('getRecentPostCount', () => {
    it('should return count of recent posts for hourly timeframe', async () => {
      // Arrange
      const pageId = 'fb-page-id';
      const timeframe = 'hour';
      const expectedCount = 5;
      mockPostRepo.count.mockResolvedValue(expectedCount);

      // Act
      const result = await repository.getRecentPostCount(pageId, timeframe);

      // Assert
      expect(mockPostRepo.count).toHaveBeenCalledWith({
        where: {
          page: { id: pageId },
          tenantId: mockTenantId,
          createdAt: MoreThan(expect.any(Date)),
        },
      });
      expect(result).toBe(expectedCount);
    });

    it('should return count of recent posts for daily timeframe', async () => {
      // Arrange
      const pageId = 'fb-page-id';
      const timeframe = 'day';
      const expectedCount = 10;
      mockPostRepo.count.mockResolvedValue(expectedCount);

      // Act
      const result = await repository.getRecentPostCount(pageId, timeframe);

      // Assert
      expect(mockPostRepo.count).toHaveBeenCalledWith({
        where: {
          page: { id: pageId },
          tenantId: mockTenantId,
          createdAt: MoreThan(expect.any(Date)),
        },
      });
      expect(result).toBe(expectedCount);
    });
  });

  // Test suite for updatePageToken method
  describe('updatePageToken', () => {
    it('should update page token successfully', async () => {
      // Arrange
      const pageId = 'fb-page-id';
      const newToken = 'new-page-token';
      const updatedPage = { ...mockPageData, accessToken: newToken };

      mockPageRepo.update.mockResolvedValue({ affected: 1 });
      mockPageRepo.findOne.mockResolvedValue(updatedPage);

      // Act
      const result = await repository.updatePageToken(pageId, newToken);

      // Assert
      expect(mockPageRepo.update).toHaveBeenCalledWith(pageId, {
        accessToken: newToken,
        updatedAt: expect.any(Date),
      });
      expect(mockPageRepo.findOne).toHaveBeenCalledWith({
        where: { id: pageId, tenantId: mockTenantId },
      });
      expect(result).toEqual(updatedPage);
    });
  });

  // Test suite for updatePageMetrics method
  describe('updatePageMetrics', () => {
    it('should update page metrics successfully', async () => {
      // Arrange
      const pageId = 'fb-page-id';
      const metrics = {
        followers: 1000,
        fans: 900,
        engagement: 500,
        impressions: 5000,
        reach: 4000,
        demographics: { age: { '18-24': 30, '25-34': 40 } },
      };

      const page = { ...mockPageData, followerCount: 500 };
      const updatedPage = { ...page, followerCount: metrics.followers };

      mockPageRepo.findOne.mockResolvedValue(page);
      mockPageRepo.save.mockResolvedValue(updatedPage);
      mockPageMetricRepo.save.mockResolvedValue({
        id: 'new-metric-id',
        page: { id: pageId },
        ...metrics,
      });

      // Act
      const result = await repository.updatePageMetrics(pageId, metrics);

      // Assert
      expect(mockPageRepo.findOne).toHaveBeenCalledWith({
        where: { id: pageId, tenantId: mockTenantId },
      });
      expect(mockPageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          followerCount: metrics.followers,
        }),
      );
      expect(mockPageMetricRepo.save).toHaveBeenCalledWith({
        page: { id: pageId },
        followerCount: metrics.followers,
        fanCount: metrics.fans,
        engagement: metrics.engagement,
        impressions: metrics.impressions,
        reach: metrics.reach,
        demographics: metrics.demographics,
        collectedAt: expect.any(Date),
      });
      expect(result).toEqual(updatedPage);
    });

    it('should throw an error when page is not found', async () => {
      // Arrange
      const pageId = 'non-existent-id';
      const metrics = { followers: 1000 };

      mockPageRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        repository.updatePageMetrics(pageId, metrics),
      ).rejects.toThrow('Page not found');
      expect(mockPageRepo.save).not.toHaveBeenCalled();
      expect(mockPageMetricRepo.save).not.toHaveBeenCalled();
    });
  });

  // Test suite for upsertPostMetrics method
  describe('upsertPostMetrics', () => {
    it('should update existing metrics', async () => {
      // Arrange
      const postId = 'fb-post-id';
      const metrics = {
        likes: 20,
        comments: 10,
        shares: 5,
        collectedAt: new Date(),
      };

      const existingMetric = {
        id: 'existing-metric-id',
        post: { id: postId },
        ...metrics,
      };

      mockEntityManager.transaction.mockImplementation(async (callback) => {
        return callback(mockEntityManager);
      });

      mockEntityManager.findOne
        .mockResolvedValueOnce(existingMetric)
        .mockResolvedValueOnce({ ...existingMetric, likes: metrics.likes });

      // Act
      const result = await repository.upsertPostMetrics({ postId, metrics });

      // Assert
      expect(mockEntityManager.transaction).toHaveBeenCalled();
      expect(mockEntityManager.findOne).toHaveBeenCalledWith(
        FacebookPostMetric,
        {
          where: {
            post: { id: postId },
            tenantId: mockTenantId,
            collectedAt: metrics.collectedAt,
          },
        },
      );
      expect(mockEntityManager.update).toHaveBeenCalledWith(
        FacebookPostMetric,
        existingMetric.id,
        {
          ...metrics,
          updatedAt: expect.any(Date),
        },
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: existingMetric.id,
        }),
      );
    });

    it('should create new metrics when they do not exist', async () => {
      // Arrange
      const postId = 'fb-post-id';
      const metrics = {
        likes: 20,
        comments: 10,
        shares: 5,
        collectedAt: new Date(),
      };

      const newMetric = {
        id: 'new-metric-id',
        post: { id: postId },
        ...metrics,
      };

      mockEntityManager.transaction.mockImplementation(async (callback) => {
        return callback(mockEntityManager);
      });

      mockEntityManager.findOne.mockResolvedValue(null);
      mockEntityManager.create.mockReturnValue(newMetric);
      mockEntityManager.save.mockResolvedValue(newMetric);

      // Act
      const result = await repository.upsertPostMetrics({ postId, metrics });

      // Assert
      expect(mockEntityManager.transaction).toHaveBeenCalled();
      expect(mockEntityManager.findOne).toHaveBeenCalledWith(
        FacebookPostMetric,
        {
          where: {
            post: { id: postId },
            tenantId: mockTenantId,
            collectedAt: metrics.collectedAt,
          },
        },
      );
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        FacebookPostMetric,
        {
          post: { id: postId },
          ...metrics,
        },
      );
      expect(mockEntityManager.save).toHaveBeenCalledWith(newMetric);
      expect(result).toEqual(newMetric);
    });
  });

  // Test suite for updatePost method
  describe('updatePost', () => {
    it('should update a post successfully', async () => {
      // Arrange
      const postId = 'fb-post-id';
      const updateData = { message: 'Updated post message' };
      const updatedPost = { ...mockPostData, ...updateData };

      mockPostRepo.update.mockResolvedValue({ affected: 1 });
      mockPostRepo.findOne.mockResolvedValue(updatedPost);

      // Act
      const result = await repository.updatePost(postId, updateData);

      // Assert
      expect(mockPostRepo.update).toHaveBeenCalledWith(postId, updateData);
      expect(mockPostRepo.findOne).toHaveBeenCalledWith({
        where: { id: postId, tenantId: mockTenantId },
        relations: ['page'],
      });
      expect(result).toEqual(updatedPost);
    });
  });

  // Test suite for updatePage method
  describe('updatePage', () => {
    it('should update a page successfully', async () => {
      // Arrange
      const pageId = 'fb-page-id';
      const updateData = { name: 'Updated Page Name' };
      const updatedPage = { ...mockPageData, ...updateData };

      mockPageRepo.update.mockResolvedValue({ affected: 1 });
      mockPageRepo.findOne.mockResolvedValue(updatedPage);

      // Act
      const result = await repository.updatePage(pageId, updateData);

      // Assert
      expect(mockPageRepo.update).toHaveBeenCalledWith(pageId, updateData);
      expect(mockPageRepo.findOne).toHaveBeenCalledWith({
        where: { id: pageId, tenantId: mockTenantId },
      });
      expect(result).toEqual(updatedPage);
    });
  });

  // Test suite for getAccountsWithExpiringTokens method
  describe('getAccountsWithExpiringTokens', () => {
    it('should return accounts with tokens expiring in the next 24 hours', async () => {
      // Arrange
      const expiringAccounts = [
        mockAccountData,
        { ...mockAccountData, id: 'fb-account-id-2' },
      ];

      mockAccountRepo.find.mockResolvedValue(expiringAccounts);

      // Act
      const result = await repository.getAccountsWithExpiringTokens();

      // Assert
      expect(mockAccountRepo.find).toHaveBeenCalledWith({
        where: {
          socialAccount: {
            platform: SocialPlatform.FACEBOOK,
            tokenExpiresAt: LessThan(expect.any(Date)),
          },
        },
        relations: ['facebookAccount'],
      });
      expect(result).toEqual(expiringAccounts);
    });
  });

  // Test suite for getActivePages method
  describe('getActivePages', () => {
    it('should return active pages with valid tokens', async () => {
      // Arrange
      const activePages = [
        mockPageData,
        { ...mockPageData, id: 'fb-page-id-2' },
      ];

      mockPageRepo.find.mockResolvedValue(activePages);

      // Act
      const result = await repository.getActivePages();

      // Assert
      expect(mockPageRepo.find).toHaveBeenCalledWith({
        relations: ['facebookAccount', 'posts', 'posts.metrics'],
        where: {
          facebookAccount: {
            socialAccount: {
              platform: SocialPlatform.FACEBOOK,
              tokenExpiresAt: MoreThan(expect.any(Date)),
            },
          },
        },
      });
      expect(result).toEqual(activePages);
    });
  });

  // Test suite for upsertPageMetrics method
  describe('upsertPageMetrics', () => {
    it('should update existing page metrics', async () => {
      // Arrange
      const pageId = 'fb-page-id';
      const metricData = {
        pageId,
        impressions: 5000,
        engagedUsers: 200,
        newFans: 20,
        pageViews: 500,
        engagements: 300,
        followers: 1000,
        collectedAt: new Date(),
      };

      const existingMetric = {
        id: 'existing-metric-id',
        page: { id: pageId },
        ...metricData,
      };
      const updatedMetric = { ...existingMetric, impressions: 6000 };

      mockPageMetricRepo.findOne.mockResolvedValue(existingMetric);
      mockPageMetricRepo.update.mockResolvedValue({ affected: 1 });
      mockPageMetricRepo.findOne
        .mockResolvedValueOnce(existingMetric)
        .mockResolvedValueOnce(updatedMetric);

      // Act
      const result = await repository.upsertPageMetrics(metricData);

      // Assert
      expect(mockPageMetricRepo.findOne).toHaveBeenCalledWith({
        where: {
          page: { id: pageId },
          tenantId: mockTenantId,
          collectedAt: metricData.collectedAt,
        },
      });
      expect(mockPageMetricRepo.update).toHaveBeenCalledWith(
        existingMetric.id,
        metricData,
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: existingMetric.id,
        }),
      );
    });

    it('should create new page metrics when they do not exist', async () => {
      // Arrange
      const pageId = 'fb-page-id';
      const metricData = {
        pageId,
        impressions: 5000,
        engagedUsers: 200,
        newFans: 20,
        pageViews: 500,
        engagements: 300,
        followers: 1000,
        collectedAt: new Date(),
      };

      const newMetric = {
        id: 'new-metric-id',
        page: { id: pageId },
        ...metricData,
      };

      mockPageMetricRepo.findOne.mockResolvedValue(null);
      mockPageMetricRepo.create.mockReturnValue(newMetric);
      mockPageMetricRepo.save.mockResolvedValue(newMetric);

      // Act
      const result = await repository.upsertPageMetrics(metricData);

      // Assert
      expect(mockPageMetricRepo.findOne).toHaveBeenCalledWith({
        where: {
          page: { id: pageId },
          tenantId: mockTenantId,
          collectedAt: metricData.collectedAt,
        },
      });
      expect(mockPageMetricRepo.create).toHaveBeenCalledWith({
        page: { id: pageId },
        ...metricData,
      });
      expect(mockPageMetricRepo.save).toHaveBeenCalledWith(newMetric);
      expect(result).toEqual(newMetric);
    });
  });

  // Test suite for deletePost method
  describe('deletePost', () => {
    it('should delete a post and its metrics successfully', async () => {
      // Arrange
      const postId = 'fb-post-id';
      const post = {
        ...mockPostData,
        metrics: [mockMetricData as FacebookPostMetric],
      };

      mockPostRepo.findOne.mockResolvedValue(post);
      mockEntityManager.transaction.mockImplementation(async (callback) => {
        return callback(mockEntityManager);
      });

      // Act
      await repository.deletePost(postId);

      // Assert
      expect(mockPostRepo.findOne).toHaveBeenCalledWith({
        where: { id: postId, tenantId: mockTenantId },
        relations: ['metrics'],
      });
      expect(mockEntityManager.transaction).toHaveBeenCalled();
      expect(mockEntityManager.remove).toHaveBeenCalledWith(post.metrics);
      expect(mockEntityManager.remove).toHaveBeenCalledWith(post);
    });

    it('should throw NotFoundException when post is not found', async () => {
      // Arrange
      const postId = 'non-existent-id';
      mockPostRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(repository.deletePost(postId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockEntityManager.transaction).not.toHaveBeenCalled();
    });
  });

  // Test suite for deleteAccount method
  describe('deleteAccount', () => {
    it('should delete an account and all associated data', async () => {
      // Arrange
      const accountId = 'fb-account-id';
      mockAccountRepo.findOne.mockResolvedValue(mockAccountData);
      mockEntityManager.transaction.mockImplementation(async (callback) => {
        return callback(mockEntityManager);
      });

      // Act
      await repository.deleteAccount(accountId);

      // Assert
      expect(mockAccountRepo.findOne).toHaveBeenCalledWith({
        where: { id: accountId, tenantId: mockTenantId },
        relations: ['socialAccount'],
      });
      expect(mockEntityManager.transaction).toHaveBeenCalled();

      // Check that pages and posts are deleted first
      expect(mockEntityManager.delete).toHaveBeenCalledWith(FacebookPage, {
        account: { id: accountId },
      });
      expect(mockEntityManager.delete).toHaveBeenCalledWith(FacebookPost, {
        account: { id: accountId },
      });

      // Check that social account is removed
      expect(mockEntityManager.remove).toHaveBeenCalledWith(
        mockAccountData.socialAccount,
      );

      // Check that the Facebook account is removed
      expect(mockEntityManager.remove).toHaveBeenCalledWith(mockAccountData);
    });

    it('should throw NotFoundException when account is not found', async () => {
      // Arrange
      const accountId = 'non-existent-id';
      mockAccountRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(repository.deleteAccount(accountId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockEntityManager.transaction).not.toHaveBeenCalled();
    });

    it('should handle case when social account is null', async () => {
      // Arrange
      const accountId = 'fb-account-id';
      const accountWithoutSocialAccount = {
        ...mockAccountData,
        socialAccount: null,
      };
      mockAccountRepo.findOne.mockResolvedValue(accountWithoutSocialAccount);
      mockEntityManager.transaction.mockImplementation(async (callback) => {
        return callback(mockEntityManager);
      });

      // Act
      await repository.deleteAccount(accountId);

      // Assert
      expect(mockEntityManager.transaction).toHaveBeenCalled();
      expect(mockEntityManager.remove).not.toHaveBeenCalledWith(null);
      expect(mockEntityManager.remove).toHaveBeenCalledWith(
        accountWithoutSocialAccount,
      );
    });
  });

  // Additional tests for edge cases and error handling

  // Test for handling transaction failures
  describe('transaction error handling', () => {
    it('should propagate errors from EntityManager transactions', async () => {
      // Arrange
      const postId = 'fb-post-id';
      const error = new Error('Transaction failed');

      mockPostRepo.findOne.mockResolvedValue(mockPostData);
      mockEntityManager.transaction.mockRejectedValue(error);

      // Act & Assert
      await expect(
        repository.upsertPostMetrics({
          postId,
          metrics: { likes: 10, collectedAt: new Date() },
        }),
      ).rejects.toThrow('Transaction failed');
    });
  });

  // Test for handling save failures
  describe('save operation error handling', () => {
    it('should propagate errors from save operations', async () => {
      // Arrange
      const error = new Error('Database error during save');
      mockAccountRepo.create.mockReturnValue(mockAccountData);
      mockAccountRepo.save.mockRejectedValue(error);

      // Act & Assert
      await expect(repository.createAccount(mockAccountData)).rejects.toThrow(
        'Database error during save',
      );
    });
  });

  // Test for handling update failures
  describe('update operation error handling', () => {
    it('should propagate errors from update operations', async () => {
      // Arrange
      const id = 'fb-account-id';
      const updateData = { name: 'Updated Account Name' };
      const error = new Error('Database error during update');

      mockAccountRepo.update.mockRejectedValue(error);

      // Act & Assert
      await expect(repository.updateAccount(id, updateData)).rejects.toThrow(
        'Database error during update',
      );
    });
  });

  // Test tenant ID isolation
  describe('tenant isolation', () => {
    it('should always include tenant ID in queries', async () => {
      // Arrange
      const differentTenantId = 'different-tenant-id';
      jest
        .spyOn(repository as any, 'getTenantId')
        .mockReturnValue(differentTenantId);

      mockAccountRepo.findOne.mockResolvedValue(null);

      // Act
      await repository.getAccountById('fb-account-id');

      // Assert
      expect(mockAccountRepo.findOne).toHaveBeenCalledWith({
        where: {
          id: 'fb-account-id',
          tenantId: differentTenantId,
        },
        relations: ['socialAccount'],
      });
    });
  });

  // Test for handling extremely large datasets
  describe('performance with large datasets', () => {
    it('should handle retrieving many pages', async () => {
      // Arrange
      const accountId = 'fb-account-id';
      const largePageSet = Array(100)
        .fill(null)
        .map((_, i) => ({
          ...mockPageData,
          id: `fb-page-id-${i}`,
        }));

      mockPageRepo.find.mockResolvedValue(largePageSet);

      // Act
      const result = await repository.getAccountPages(accountId);

      // Assert
      expect(mockPageRepo.find).toHaveBeenCalledWith({
        where: {
          facebookAccount: { id: accountId },
          tenantId: mockTenantId,
        },
      });
      expect(result).toHaveLength(100);
      expect(result[99].id).toBe('fb-page-id-99');
    });
  });

  // Test for null handling in metrics
  describe('metrics null handling', () => {
    it('should handle null values in metrics data', async () => {
      // Arrange
      const pageId = 'fb-page-id';
      const metricsWithNulls = {
        followers: 1000,
        fans: null,
        engagement: undefined,
        impressions: 5000,
        reach: 4000,
        demographics: null,
      };

      const page = { ...mockPageData };

      mockPageRepo.findOne.mockResolvedValue(page);
      mockPageRepo.save.mockResolvedValue({
        ...page,
        followerCount: metricsWithNulls.followers,
      });
      mockPageMetricRepo.save.mockImplementation((data) => data);

      // Act
      await repository.updatePageMetrics(pageId, metricsWithNulls);

      // Assert
      expect(mockPageMetricRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          followerCount: 1000,
          fanCount: null,
          engagement: undefined,
          impressions: 5000,
          reach: 4000,
          demographics: null,
        }),
      );
    });
  });

  // Test for date handling
  describe('date handling', () => {
    it('should correctly handle date objects in queries', async () => {
      // Arrange
      const now = new Date();
      jest.spyOn(global, 'Date').mockImplementation(() => now);

      mockPostRepo.find.mockResolvedValue([mockPostData]);

      // Act
      await repository.getRecentPosts(12);

      // Assert
      const expectedCutoff = new Date(now);
      expectedCutoff.setHours(expectedCutoff.getHours() - 12);

      expect(mockPostRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: MoreThan(expectedCutoff),
          }),
        }),
      );

      // Restore the Date implementation
      jest.restoreAllMocks();
    });
  });
});
