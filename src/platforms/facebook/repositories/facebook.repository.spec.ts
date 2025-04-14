/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  MoreThan,
  LessThan,
  DataSource,
} from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { FacebookRepository } from './facebook.repository';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import { AuthState } from '../../entities/facebook-entities/auth-state.entity';
import { FacebookAccount } from '../../entities/facebook-entities/facebook-account.entity';
import { FacebookPageMetric } from '../../entities/facebook-entities/facebook-page-metric.entity';
import { FacebookPage } from '../../entities/facebook-entities/facebook-page.entity';
import { FacebookPostMetric } from '../../entities/facebook-entities/facebook-post-metric.entity';
import { FacebookPost } from '../../entities/facebook-entities/facebook-post.entity';
import { SocialAccount } from '../../../platforms/entities/notifications/entity/social-account.entity';

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
  let socialAccountRepo: Repository<SocialAccount>;
  let entityManager: EntityManager;
  let dataSource: DataSource;

  const mockTenantId = 'test-tenant-id';

  // Mock data
  const mockSocialAccount: Partial<SocialAccount> = {
    id: 'social-account-id',
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    tokenExpiresAt: new Date(Date.now() + 3600000),
    platform: SocialPlatform.FACEBOOK,
    tenantId: mockTenantId,
  };

  const mockAccountData: Partial<FacebookAccount> = {
    id: 'fb-account-id',
    name: 'Test Account',
    userId: 'test-user-id',
    facebookUserId: 'fb-123',
    tenantId: mockTenantId,
    socialAccount: mockSocialAccount as SocialAccount,
  };

  const mockPageData: Partial<FacebookPage> = {
    id: 'fb-page-id',
    name: 'Test Page',
    accessToken: 'test-page-token',
    pageId: 'external-page-id',
    facebookAccount: mockAccountData as FacebookAccount,
    tenantId: mockTenantId,
    permissions: ['CREATE_CONTENT'],
  };

  const mockPostData: Partial<FacebookPost> = {
    id: 'fb-post-id',
    postId: 'external-post-id',
    page: mockPageData as FacebookPage,
    account: mockAccountData as FacebookAccount,
    isPublished: true,
    metrics: [],
    tenantId: mockTenantId,
  };

  const mockMetricData: Partial<FacebookPostMetric> = {
    id: 'fb-metric-id',
    post: mockPostData as FacebookPost,
    likesCount: 10,
    commentsCount: 5,
    sharesCount: 2,
    reach: 1000,
    impressions: 1500,
    collectedAt: new Date(),
    tenantId: mockTenantId,
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
    tenantId: mockTenantId,
  };

  // Mocks for each repository
  const mockAccountRepo = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
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
    delete: jest.fn(),
  };

  const mockPostRepo = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  };

  const mockMetricRepo = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };

  const mockPageMetricRepo = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };

  const mockSocialAccountRepo = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
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

  const mockDataSource = {
    transaction: jest.fn(),
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
          provide: getRepositoryToken(SocialAccount),
          useValue: mockSocialAccountRepo,
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
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
    socialAccountRepo = module.get<Repository<SocialAccount>>(
      getRepositoryToken(SocialAccount),
    );
    entityManager = module.get<EntityManager>(EntityManager);
    dataSource = module.get<DataSource>(DataSource);

    // Mock the getTenantId method
    jest.spyOn(repository as any, 'getTenantId').mockReturnValue(mockTenantId);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('createAccount', () => {
    it('should create a new Facebook account with social account', async () => {
      // Arrange
      const { socialAccount, ...facebookAccountData } = mockAccountData;

      const newSocialAccount = {
        ...mockSocialAccount,
        id: 'new-social-account-id',
      };
      const newFacebookAccount = {
        ...facebookAccountData,
        id: 'new-fb-account-id',
        socialAccount: newSocialAccount,
      };

      mockSocialAccountRepo.create.mockReturnValue(newSocialAccount);
      mockAccountRepo.create.mockReturnValue(newFacebookAccount);

      mockDataSource.transaction.mockImplementation(async (callback) => {
        const manager = {
          save: jest
            .fn()
            .mockResolvedValueOnce(newSocialAccount)
            .mockResolvedValueOnce(newFacebookAccount),
        };
        return callback(manager);
      });

      // Act
      const result = await repository.createAccount(mockAccountData);

      // Assert
      expect(mockSocialAccountRepo.create).toHaveBeenCalledWith({
        ...mockSocialAccount,
        tenantId: mockTenantId,
      });
      expect(mockAccountRepo.create).toHaveBeenCalledWith({
        ...facebookAccountData,
        socialAccount: newSocialAccount,
      });
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(result).toEqual(newFacebookAccount);
    });

    it('should throw an error if transaction fails', async () => {
      // Arrange
      const error = new Error('Transaction failed');
      mockDataSource.transaction.mockRejectedValue(error);

      // Act & Assert
      await expect(repository.createAccount(mockAccountData)).rejects.toThrow(
        'Transaction failed',
      );
    });
  });

  describe('createAuthState', () => {
    it('should create an auth state for a user', async () => {
      // Arrange
      const userId = 'test-user-id';
      const expectedState = 'mocked-random-state';

      mockAuthStateRepo.create.mockReturnValue({
        state: expectedState,
        userId,
        platform: SocialPlatform.FACEBOOK,
        expiresAt: expect.any(Date),
      });
      mockAuthStateRepo.save.mockResolvedValue({
        state: expectedState,
        userId,
        platform: SocialPlatform.FACEBOOK,
        expiresAt: expect.any(Date),
      });

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

    it('should set default permissions if none provided', async () => {
      // Arrange
      const pageWithoutPermissions = {
        ...mockPageData,
        permissions: undefined,
      };
      const savedPage = {
        ...pageWithoutPermissions,
        permissions: ['CREATE_CONTENT'],
      };

      mockPageRepo.create.mockReturnValue(pageWithoutPermissions);
      mockPageRepo.save.mockResolvedValue(savedPage);

      // Act
      const result = await repository.createPage(pageWithoutPermissions);

      // Assert
      expect(mockPageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ permissions: ['CREATE_CONTENT'] }),
      );
      expect(result).toEqual(savedPage);
    });
  });

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

  describe('getAccountById', () => {
    it('should return a Facebook account by ID', async () => {
      // Arrange
      const userId = 'test-user-id';
      mockAccountRepo.findOne.mockResolvedValue(mockAccountData);

      // Act
      const result = await repository.getAccountById(userId);

      // Assert
      expect(mockAccountRepo.findOne).toHaveBeenCalledWith({
        where: {
          userId,
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
        relations: ['facebookAccount'],
      });
      expect(result).toEqual(pages);
    });
  });

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

      // Mock getAccountById to return updated account
      const updatedAccount = {
        ...mockAccountData,
        socialAccount: {
          ...mockAccountData.socialAccount,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
        },
      };

      // Use spyOn to allow this to be mocked but restored
      jest
        .spyOn(repository, 'getAccountById')
        .mockResolvedValue(updatedAccount as FacebookAccount);

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
      expect(repository.getAccountById).toHaveBeenCalledWith(
        mockAccountData.userId,
      );
      expect(result).toEqual(updatedAccount);
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
        tenantId: mockTenantId,
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
        tenantId: mockTenantId,
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

  describe('updatePost', () => {
    it('should update a post successfully', async () => {
      // Arrange
      const postId = 'fb-post-id';
      const updateData = {
        message: 'Updated post message',
      } as unknown as FacebookPost;
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

  describe('updatePage', () => {
    it('should update a page successfully', async () => {
      // Arrange
      const pageId = 'fb-page-id';
      const updateData = { name: 'Updated Page Name' };
      const page = { ...mockPageData };
      const updatedPage = { ...page, ...updateData };

      mockPageRepo.findOne.mockResolvedValue(page);
      mockPageRepo.save.mockResolvedValue(updatedPage);

      // Act
      const result = await repository.updatePage(pageId, updateData);

      // Assert
      expect(mockPageRepo.findOne).toHaveBeenCalledWith({
        where: { id: pageId, tenantId: mockTenantId },
      });
      expect(mockPageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ...page,
          ...updateData,
        }),
      );
      expect(result).toEqual(updatedPage);
    });

    it('should throw NotFoundException when page not found', async () => {
      // Arrange
      const pageId = 'non-existent-id';
      const updateData = { name: 'Updated Page Name' };
      mockPageRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(repository.updatePage(pageId, updateData)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPageRepo.save).not.toHaveBeenCalled();
    });

    it('should ensure permissions is set when updating', async () => {
      // Arrange
      const pageId = 'fb-page-id';
      const updateData = { name: 'Updated Page Name' };
      const pageWithoutPermissions = { ...mockPageData, permissions: [] };
      const updatedPage = {
        ...pageWithoutPermissions,
        ...updateData,
        permissions: ['CREATE_CONTENT'],
      };

      mockPageRepo.findOne.mockResolvedValue(pageWithoutPermissions);
      mockPageRepo.save.mockResolvedValue(updatedPage);

      // Act
      const result = await repository.updatePage(pageId, updateData);

      // Assert
      expect(mockPageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          permissions: ['CREATE_CONTENT'],
        }),
      );
      expect(result).toEqual(updatedPage);
    });
  });

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
        tenantId: mockTenantId,
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
      expect(result).toEqual(updatedMetric);
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
        tenantId: mockTenantId,
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
          metrics: { collectedAt: new Date() },
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
        'Transaction failed',
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
          userId: 'fb-account-id',
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
        relations: ['facebookAccount'],
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
