import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, EntityManager, MoreThan, LessThan } from 'typeorm';
import { SocialAccount } from '../../../platforms/entity/social-account.entity';
import { SocialPlatform } from '../../../enum/social-platform.enum';
import { NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { FacebookRepository } from './facebook.repository';
import { FacebookAccount } from '../entity/facebook-account.entity';
import { AuthState } from '../entity/auth-state.entity';
import { FacebookPage } from '../entity/facebook-page.entity';
import { FacebookPost } from '../entity/facebook-post.entity';
import { FacebookPostMetric } from '../entity/facebook-post-metric.entity';
import { FacebookPageMetric } from '../entity/facebook-page-metric.entity';

// Mock crypto to control randomBytes output
jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
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

  // Common test data
  const testTenantId = 'test-tenant-id';
  const testUserId = 'test-user-id';
  const testAccountId = 'test-account-id';
  const testPageId = 'test-page-id';
  const testPostId = 'test-post-id';

  // Setup mock data and repositories
  const mockAccount = {
    id: testAccountId,
    tenantId: testTenantId,
    socialAccount: {
      id: 'social-account-id',
      accessToken: 'old-token',
      refreshToken: 'old-refresh-token',
      tokenExpiresAt: new Date(),
    },
  };

  const mockPage = {
    id: testPageId,
    tenantId: testTenantId,
    facebookAccount: mockAccount,
    accessToken: 'page-token',
  };

  const mockPost = {
    id: testPostId,
    tenantId: testTenantId,
    page: mockPage,
    metrics: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacebookRepository,
        {
          provide: getRepositoryToken(FacebookAccount),
          useFactory: jest.fn(() => ({
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
          })),
        },
        {
          provide: getRepositoryToken(AuthState),
          useFactory: jest.fn(() => ({
            create: jest.fn(),
            save: jest.fn(),
          })),
        },
        {
          provide: getRepositoryToken(FacebookPage),
          useFactory: jest.fn(() => ({
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
          })),
        },
        {
          provide: getRepositoryToken(FacebookPost),
          useFactory: jest.fn(() => ({
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
          })),
        },
        {
          provide: getRepositoryToken(FacebookPostMetric),
          useFactory: jest.fn(() => ({
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          })),
        },
        {
          provide: getRepositoryToken(FacebookPageMetric),
          useFactory: jest.fn(() => ({
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          })),
        },
        {
          provide: EntityManager,
          useFactory: jest.fn(() => ({
            update: jest.fn(),
            findOne: jest.fn(),
            transaction: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            delete: jest.fn(),
          })),
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

    // Set tenant ID for all tests
    jest.spyOn(repository as any, 'getTenantId').mockReturnValue(testTenantId);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAccount', () => {
    it('should create and save a Facebook account', async () => {
      const accountData = { name: 'Test Account', tenantId: testTenantId };
      const createdAccount = { ...accountData, id: testAccountId };

      jest.spyOn(accountRepo, 'create').mockReturnValue(createdAccount as any);
      jest.spyOn(accountRepo, 'save').mockResolvedValue(createdAccount as any);

      const result = await repository.createAccount(accountData);

      expect(accountRepo.create).toHaveBeenCalledWith(accountData);
      expect(accountRepo.save).toHaveBeenCalledWith(createdAccount);
      expect(result).toEqual(createdAccount);
    });
  });

  describe('createAuthState', () => {
    it('should create and save an auth state with a random string', async () => {
      const randomString = '123456789abcdef';

      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: () => randomString,
      });

      jest
        .spyOn(authStateRepo, 'create')
        .mockImplementation((data) => data as any);
      jest.spyOn(authStateRepo, 'save').mockResolvedValue({} as any);

      const result = await repository.createAuthState(testUserId);

      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      expect(authStateRepo.create).toHaveBeenCalledWith({
        state: randomString,
        userId: testUserId,
        platform: SocialPlatform.FACEBOOK,
        expiresAt: expect.any(Date),
      });
      expect(authStateRepo.save).toHaveBeenCalled();
      expect(result).toEqual(randomString);
    });
  });

  describe('updateAccount', () => {
    it('should update an account and return the updated entity', async () => {
      const updateData = { name: 'Updated Name' };
      const updatedAccount = { ...mockAccount, ...updateData };

      jest.spyOn(accountRepo, 'update').mockResolvedValue(undefined);
      jest
        .spyOn(accountRepo, 'findOne')
        .mockResolvedValue(updatedAccount as any);

      const result = await repository.updateAccount(testAccountId, updateData);

      expect(accountRepo.update).toHaveBeenCalledWith(
        testAccountId,
        updateData,
      );
      expect(accountRepo.findOne).toHaveBeenCalledWith({
        where: { id: testAccountId, tenantId: testTenantId },
      });
      expect(result).toEqual(updatedAccount);
    });
  });

  describe('createPage', () => {
    it('should create and save a Facebook page', async () => {
      const pageData = { name: 'Test Page', tenantId: testTenantId };
      const createdPage = { ...pageData, id: testPageId };

      jest.spyOn(pageRepo, 'create').mockReturnValue(createdPage as any);
      jest.spyOn(pageRepo, 'save').mockResolvedValue(createdPage as any);

      const result = await repository.createPage(pageData);

      expect(pageRepo.create).toHaveBeenCalledWith(pageData);
      expect(pageRepo.save).toHaveBeenCalledWith(createdPage);
      expect(result).toEqual(createdPage);
    });
  });

  describe('createPost', () => {
    it('should create and save a Facebook post', async () => {
      const postData = { message: 'Test Post', tenantId: testTenantId };
      const createdPost = { ...postData, id: testPostId };

      jest.spyOn(postRepo, 'create').mockReturnValue(createdPost as any);
      jest.spyOn(postRepo, 'save').mockResolvedValue(createdPost as any);

      const result = await repository.createPost(postData);

      expect(postRepo.create).toHaveBeenCalledWith(postData);
      expect(postRepo.save).toHaveBeenCalledWith(createdPost);
      expect(result).toEqual(createdPost);
    });
  });

  describe('getAccountById', () => {
    it('should find and return an account by ID', async () => {
      jest.spyOn(accountRepo, 'findOne').mockResolvedValue(mockAccount as any);

      const relations = ['socialAccount'];
      const result = await repository.getAccountById(testAccountId);

      expect(accountRepo.findOne).toHaveBeenCalledWith({
        where: { id: testAccountId, tenantId: testTenantId },
        relations: relations,
      });
      expect(result).toEqual(mockAccount);
    });

    it('should return null if account not found', async () => {
      jest.spyOn(accountRepo, 'findOne').mockResolvedValue(null);

      const result = await repository.getAccountById('non-existent-id');

      expect(accountRepo.findOne).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('getPageById', () => {
    it('should find and return a page by ID', async () => {
      jest.spyOn(pageRepo, 'findOne').mockResolvedValue(mockPage as any);

      const relations = ['facebookAccount'];
      const result = await repository.getPageById(testPageId, relations);

      expect(pageRepo.findOne).toHaveBeenCalledWith({
        where: { id: testPageId, tenantId: testTenantId },
        relations: relations,
      });
      expect(result).toEqual(mockPage);
    });
  });

  describe('getPostById', () => {
    it('should find and return a post by ID', async () => {
      jest.spyOn(postRepo, 'findOne').mockResolvedValue(mockPost as any);

      const relations = ['metrics'];
      const result = await repository.getPostById(testPostId, relations);

      expect(postRepo.findOne).toHaveBeenCalledWith({
        where: { id: testPostId, tenantId: testTenantId },
        relations: relations,
      });
      expect(result).toEqual(mockPost);
    });
  });

  describe('getRecentPosts', () => {
    it('should find and return recent posts with default timeframe', async () => {
      const mockPosts = [mockPost];
      jest.spyOn(postRepo, 'find').mockResolvedValue(mockPosts as any);

      const result = await repository.getRecentPosts();

      expect(postRepo.find).toHaveBeenCalledWith({
        where: {
          createdAt: MoreThan(expect.any(Date)),
          isPublished: true,
          tenantId: testTenantId,
        },
        relations: ['account'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(mockPosts);
    });

    it('should find and return recent posts with custom timeframe', async () => {
      const mockPosts = [mockPost];
      jest.spyOn(postRepo, 'find').mockResolvedValue(mockPosts as any);

      const timeframe = 48; // 48 hours
      const result = await repository.getRecentPosts(timeframe);

      expect(postRepo.find).toHaveBeenCalledWith({
        where: {
          createdAt: MoreThan(expect.any(Date)),
          isPublished: true,
          tenantId: testTenantId,
        },
        relations: ['account'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(mockPosts);
    });
  });

  describe('getAccountPages', () => {
    it('should find and return pages for an account', async () => {
      const mockPages = [mockPage];
      jest.spyOn(pageRepo, 'find').mockResolvedValue(mockPages as any);

      const result = await repository.getAccountPages(testAccountId);

      expect(pageRepo.find).toHaveBeenCalledWith({
        where: {
          facebookAccount: { id: testAccountId },
          tenantId: testTenantId,
        },
      });
      expect(result).toEqual(mockPages);
    });
  });

  describe('updateAccountTokens', () => {
    it('should update the tokens for a social account', async () => {
      const tokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(),
      };

      jest.spyOn(accountRepo, 'findOne').mockResolvedValue(mockAccount as any);
      jest
        .spyOn(entityManager, 'update')
        .mockResolvedValue({ affected: 1 } as any);
      jest
        .spyOn(repository, 'getAccountById')
        .mockResolvedValue(mockAccount as any);

      const result = await repository.updateAccountTokens(
        testAccountId,
        tokens,
      );

      expect(accountRepo.findOne).toHaveBeenCalledWith({
        where: { id: testAccountId, tenantId: testTenantId },
        relations: ['socialAccount'],
      });
      expect(entityManager.update).toHaveBeenCalledWith(
        SocialAccount,
        mockAccount.socialAccount.id,
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          updatedAt: expect.any(Date),
        },
      );
      expect(repository.getAccountById).toHaveBeenCalledWith(testAccountId);
      expect(result).toEqual(mockAccount);
    });

    it('should throw NotFoundException if account is not found', async () => {
      jest.spyOn(accountRepo, 'findOne').mockResolvedValue(null);

      const tokens = {
        accessToken: 'new-token',
        expiresAt: new Date(),
      };

      await expect(
        repository.updateAccountTokens(testAccountId, tokens),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if social account is not found', async () => {
      jest
        .spyOn(accountRepo, 'findOne')
        .mockResolvedValue({ ...mockAccount, socialAccount: null } as any);

      const tokens = {
        accessToken: 'new-token',
        expiresAt: new Date(),
      };

      await expect(
        repository.updateAccountTokens(testAccountId, tokens),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPagePosts', () => {
    it('should find and return posts for a page with default limit', async () => {
      const mockPosts = [mockPost];
      jest.spyOn(postRepo, 'find').mockResolvedValue(mockPosts as any);

      const result = await repository.getPagePosts(testPageId);

      expect(postRepo.find).toHaveBeenCalledWith({
        where: { page: { id: testPageId }, tenantId: testTenantId },
        order: { createdAt: 'DESC' },
        take: 10,
        relations: ['metrics'],
      });
      expect(result).toEqual(mockPosts);
    });

    it('should find and return posts for a page with custom limit', async () => {
      const mockPosts = [mockPost];
      jest.spyOn(postRepo, 'find').mockResolvedValue(mockPosts as any);

      const limit = 5;
      const result = await repository.getPagePosts(testPageId, limit);

      expect(postRepo.find).toHaveBeenCalledWith({
        where: { page: { id: testPageId }, tenantId: testTenantId },
        order: { createdAt: 'DESC' },
        take: limit,
        relations: ['metrics'],
      });
      expect(result).toEqual(mockPosts);
    });
  });

  describe('getRecentPostCount', () => {
    it('should count recent posts from the past hour', async () => {
      jest.spyOn(postRepo, 'count').mockResolvedValue(5);

      const result = await repository.getRecentPostCount(testPageId, 'hour');

      expect(postRepo.count).toHaveBeenCalledWith({
        where: {
          page: { id: testPageId },
          tenantId: testTenantId,
          createdAt: MoreThan(expect.any(Date)),
        },
      });
      expect(result).toBe(5);
    });

    it('should count recent posts from the past day', async () => {
      jest.spyOn(postRepo, 'count').mockResolvedValue(10);

      const result = await repository.getRecentPostCount(testPageId, 'day');

      expect(postRepo.count).toHaveBeenCalledWith({
        where: {
          page: { id: testPageId },
          tenantId: testTenantId,
          createdAt: MoreThan(expect.any(Date)),
        },
      });
      expect(result).toBe(10);
    });
  });

  describe('updatePageToken', () => {
    it('should update a page token', async () => {
      const newToken = 'new-page-token';

      jest.spyOn(pageRepo, 'update').mockResolvedValue({ affected: 1 } as any);
      jest.spyOn(pageRepo, 'findOne').mockResolvedValue(mockPage as any);

      const result = await repository.updatePageToken(testPageId, newToken);

      expect(pageRepo.update).toHaveBeenCalledWith(testPageId, {
        accessToken: newToken,
        updatedAt: expect.any(Date),
      });
      expect(pageRepo.findOne).toHaveBeenCalledWith({
        where: { id: testPageId, tenantId: testTenantId },
      });
      expect(result).toEqual(mockPage);
    });
  });

  describe('updatePageMetrics', () => {
    it('should update page metrics and create a metrics snapshot', async () => {
      const metrics = {
        followers: 1000,
        fans: 950,
        engagement: 200,
        impressions: 5000,
        reach: 3000,
        demographics: { age: { '18-24': 30, '25-34': 45 } },
      };

      const updatedPage = { ...mockPage, followerCount: metrics.followers };

      jest.spyOn(pageRepo, 'findOne').mockResolvedValue(mockPage as any);
      jest.spyOn(pageRepo, 'save').mockResolvedValue(updatedPage as any);
      jest.spyOn(pageMetricRepo, 'save').mockResolvedValue({} as any);

      expect(pageRepo.findOne).toHaveBeenCalledWith({
        where: { id: testPageId, tenantId: testTenantId },
      });
      expect(pageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          followerCount: metrics.followers,
        }),
      );
    });
  });

  describe('deletePost', () => {
    it('should delete a post and its metrics', async () => {
      const mockPostWithMetrics = {
        ...mockPost,
        metrics: [{ id: 'metric-1' }, { id: 'metric-2' }],
      };

      jest
        .spyOn(postRepo, 'findOne')
        .mockResolvedValue(mockPostWithMetrics as any);
      jest
        .spyOn(entityManager, 'transaction')
        .mockImplementation(async (cb) => {
          return await cb(entityManager);
        });
      jest.spyOn(entityManager, 'remove').mockResolvedValue({} as any);

      await repository.deletePost(testPostId);

      expect(postRepo.findOne).toHaveBeenCalledWith({
        where: { id: testPostId, tenantId: testTenantId },
        relations: ['metrics'],
      });
      expect(entityManager.remove).toHaveBeenCalledWith(
        mockPostWithMetrics.metrics,
      );
      expect(entityManager.remove).toHaveBeenCalledWith(mockPostWithMetrics);
    });

    it('should throw NotFoundException if post is not found', async () => {
      jest.spyOn(postRepo, 'findOne').mockResolvedValue(null);

      await expect(repository.deletePost('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteAccount', () => {
    it('should delete an account and all related entities', async () => {
      jest.spyOn(accountRepo, 'findOne').mockResolvedValue(mockAccount as any);
      jest
        .spyOn(entityManager, 'transaction')
        .mockImplementation(async (cb) => {
          return await cb(entityManager);
        });
      jest
        .spyOn(entityManager, 'delete')
        .mockResolvedValue({ affected: 1 } as any);
      jest.spyOn(entityManager, 'remove').mockResolvedValue({} as any);

      await repository.deleteAccount(testAccountId);

      expect(accountRepo.findOne).toHaveBeenCalledWith({
        where: { id: testAccountId, tenantId: testTenantId },
        relations: ['socialAccount'],
      });
      // Delete associated pages
      expect(entityManager.delete).toHaveBeenCalledWith(FacebookPage, {
        account: { id: testAccountId },
      });
      // Delete associated posts
      expect(entityManager.delete).toHaveBeenCalledWith(FacebookPost, {
        account: { id: testAccountId },
      });
      // Delete social account
      expect(entityManager.remove).toHaveBeenCalledWith(
        mockAccount.socialAccount,
      );
      // Delete the account itself
      expect(entityManager.remove).toHaveBeenCalledWith(mockAccount);
    });

    it('should throw NotFoundException if account is not found', async () => {
      jest.spyOn(accountRepo, 'findOne').mockResolvedValue(null);

      await expect(repository.deleteAccount('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle when social account is not present', async () => {
      const accountWithoutSocial = { ...mockAccount, socialAccount: null };

      jest
        .spyOn(accountRepo, 'findOne')
        .mockResolvedValue(accountWithoutSocial as any);
      jest
        .spyOn(entityManager, 'transaction')
        .mockImplementation(async (cb) => {
          return await cb(entityManager);
        });
      jest
        .spyOn(entityManager, 'delete')
        .mockResolvedValue({ affected: 1 } as any);
      jest.spyOn(entityManager, 'remove').mockResolvedValue({} as any);

      await repository.deleteAccount(testAccountId);

      // Should not attempt to remove a non-existent social account
      expect(entityManager.remove).not.toHaveBeenCalledWith(null);
      // Should still delete the account
      expect(entityManager.remove).toHaveBeenCalledWith(accountWithoutSocial);
    });
  });

  describe('upsertPostMetrics', () => {
    it('should update existing post metrics', async () => {
      const mockMetrics = {
        likes: 100,
        comments: 50,
        shares: 25,
        collectedAt: new Date(),
      };

      const existingMetric = { id: 'metric-id', ...mockMetrics };
      const updatedMetric = { ...existingMetric, likes: 150 };

      jest
        .spyOn(entityManager, 'transaction')
        .mockImplementation(async (cb) => {
          return await cb(entityManager);
        });

      jest
        .spyOn(entityManager, 'findOne')
        .mockResolvedValueOnce(existingMetric as any);
      jest
        .spyOn(entityManager, 'update')
        .mockResolvedValue({ affected: 1 } as any);
      jest
        .spyOn(entityManager, 'findOne')
        .mockResolvedValueOnce(updatedMetric as any);

      const result = await repository.upsertPostMetrics({
        postId: testPostId,
        metrics: mockMetrics,
      });

      expect(entityManager.findOne).toHaveBeenCalledWith(FacebookPostMetric, {
        where: {
          post: { id: testPostId },
          tenantId: testTenantId,
          collectedAt: mockMetrics.collectedAt,
        },
      });
      expect(entityManager.update).toHaveBeenCalledWith(
        FacebookPostMetric,
        existingMetric.id,
        expect.objectContaining({
          ...mockMetrics,
          updatedAt: expect.any(Date),
        }),
      );
      expect(result).toEqual(updatedMetric);
    });

    it('should create new post metrics if not existing', async () => {
      const mockMetrics = {
        likes: 100,
        comments: 50,
        shares: 25,
        collectedAt: new Date(),
      };

      const newMetric = { id: 'new-metric-id', ...mockMetrics };

      jest
        .spyOn(entityManager, 'transaction')
        .mockImplementation(async (cb) => {
          return await cb(entityManager);
        });

      jest.spyOn(entityManager, 'findOne').mockResolvedValueOnce(null);
      jest.spyOn(entityManager, 'create').mockReturnValue(newMetric as any);
      jest.spyOn(entityManager, 'save').mockResolvedValue(newMetric as any);

      const result = await repository.upsertPostMetrics({
        postId: testPostId,
        metrics: mockMetrics,
      });

      expect(entityManager.findOne).toHaveBeenCalledWith(FacebookPostMetric, {
        where: {
          post: { id: testPostId },
          tenantId: testTenantId,
          collectedAt: mockMetrics.collectedAt,
        },
      });
      expect(entityManager.create).toHaveBeenCalledWith(FacebookPostMetric, {
        post: { id: testPostId },
        ...mockMetrics,
      });
      expect(entityManager.save).toHaveBeenCalledWith(newMetric);
      expect(result).toEqual(newMetric);
    });
  });

  describe('updatePost', () => {
    it('should update a post and return the updated entity', async () => {
      const updateData = { message: 'Updated message' };
      const updatedPost = { ...mockPost, ...updateData };

      jest.spyOn(postRepo, 'update').mockResolvedValue({ affected: 1 } as any);
      jest.spyOn(postRepo, 'findOne').mockResolvedValue(updatedPost as any);

      const result = await repository.updatePost(testPostId, updateData);

      expect(postRepo.update).toHaveBeenCalledWith(testPostId, updateData);
      expect(postRepo.findOne).toHaveBeenCalledWith({
        where: { id: testPostId, tenantId: testTenantId },
        relations: ['page'],
      });
      expect(result).toEqual(updatedPost);
    });
  });

  describe('updatePage', () => {
    it('should update a page and return the updated entity', async () => {
      const updateData = { name: 'Updated Page Name' };
      const updatedPage = { ...mockPage, ...updateData };

      jest.spyOn(pageRepo, 'update').mockResolvedValue({ affected: 1 } as any);
      jest.spyOn(pageRepo, 'findOne').mockResolvedValue(updatedPage as any);

      const result = await repository.updatePage(testPageId, updateData);

      expect(pageRepo.update).toHaveBeenCalledWith(testPageId, updateData);
      expect(pageRepo.findOne).toHaveBeenCalledWith({
        where: { id: testPageId, tenantId: testTenantId },
      });
      expect(result).toEqual(updatedPage);
    });
  });

  describe('getAccountsWithExpiringTokens', () => {
    it('should find accounts with tokens expiring within 24 hours', async () => {
      const expiringAccounts = [mockAccount];

      jest
        .spyOn(accountRepo, 'find')
        .mockResolvedValue(expiringAccounts as any);

      const result = await repository.getAccountsWithExpiringTokens();

      expect(accountRepo.find).toHaveBeenCalledWith({
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
    it('should find active pages with valid tokens', async () => {
      const activePages = [mockPage];

      jest.spyOn(pageRepo, 'find').mockResolvedValue(activePages as any);

      const result = await repository.getActivePages();

      expect(pageRepo.find).toHaveBeenCalledWith({
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
      const mockMetrics = {
        pageId: testPageId,
        impressions: 5000,
        engagedUsers: 1000,
        newFans: 200,
        pageViews: 3000,
        engagements: 1500,
        followers: 2000,
        collectedAt: new Date(),
      };

      const existingMetric = { id: 'page-metric-id', ...mockMetrics };
      const updatedMetric = { ...existingMetric, impressions: 6000 };

      jest
        .spyOn(pageMetricRepo, 'findOne')
        .mockResolvedValue(existingMetric as any);
      jest
        .spyOn(pageMetricRepo, 'update')
        .mockResolvedValue({ affected: 1 } as any);
      jest
        .spyOn(pageMetricRepo, 'findOne')
        .mockResolvedValueOnce(updatedMetric as any);

      const result = await repository.upsertPageMetrics(mockMetrics);

      expect(pageMetricRepo.findOne).toHaveBeenCalledWith({
        where: {
          page: { id: testPageId },
          tenantId: testTenantId,
          collectedAt: mockMetrics.collectedAt,
        },
      });
      expect(pageMetricRepo.update).toHaveBeenCalledWith(
        existingMetric.id,
        mockMetrics,
      );
      expect(result).toEqual(updatedMetric);
    });
  });
});
