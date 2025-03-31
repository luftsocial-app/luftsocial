import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, EntityManager, MoreThan, LessThan } from 'typeorm';
import * as crypto from 'crypto';
import { InstagramRepository } from './instagram.repository';
import { NotFoundException } from '@nestjs/common';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import { SocialAccount } from '../../entities/notifications/entity/social-account.entity';
import { AuthState } from '../../entities/facebook-entities/auth-state.entity';
import { InstagramAccount } from '../../entities/instagram-entities/instagram-account.entity';
import { InstagramMetric } from '../../entities/instagram-entities/instagram-metric.entity';
import { InstagramPost } from '../../entities/instagram-entities/instagram-post.entity';
import { InstagramRateLimit } from '../../entities/instagram-entities/instagram-rate-limit.entity';

// Mock crypto.randomBytes
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('mock-state-value'),
  }),
}));

describe('InstagramRepository', () => {
  let repository: InstagramRepository;
  let accountRepository: jest.Mocked<Repository<InstagramAccount>>;
  let mediaRepository: jest.Mocked<Repository<InstagramPost>>;
  let metricRepository: jest.Mocked<Repository<InstagramMetric>>;
  let authStateRepository: jest.Mocked<Repository<AuthState>>;
  let rateLimitRepository: jest.Mocked<Repository<InstagramRateLimit>>;
  // let socialAccountRepository: jest.Mocked<Repository<SocialAccount>>;
  let entityManager: jest.Mocked<EntityManager>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramRepository,
        {
          provide: getRepositoryToken(InstagramAccount),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(InstagramPost),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(InstagramMetric),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuthState),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(InstagramRateLimit),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SocialAccount),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: EntityManager,
          useValue: {
            update: jest.fn(),
            transaction: jest.fn(),
            delete: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<InstagramRepository>(InstagramRepository);
    accountRepository = module.get(
      getRepositoryToken(InstagramAccount),
    ) as jest.Mocked<Repository<InstagramAccount>>;
    mediaRepository = module.get(
      getRepositoryToken(InstagramPost),
    ) as jest.Mocked<Repository<InstagramPost>>;
    metricRepository = module.get(
      getRepositoryToken(InstagramMetric),
    ) as jest.Mocked<Repository<InstagramMetric>>;
    authStateRepository = module.get(
      getRepositoryToken(AuthState),
    ) as jest.Mocked<Repository<AuthState>>;
    rateLimitRepository = module.get(
      getRepositoryToken(InstagramRateLimit),
    ) as jest.Mocked<Repository<InstagramRateLimit>>;
    // socialAccountRepository = module.get(
    //   getRepositoryToken(SocialAccount),
    // ) as jest.Mocked<Repository<SocialAccount>>;
    entityManager = module.get(EntityManager) as jest.Mocked<EntityManager>;

    // Mock the getTenantId method
    jest
      .spyOn(repository as any, 'getTenantId')
      .mockReturnValue('test-tenant-id');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPost', () => {
    it('should create and save a new post', async () => {
      const postData = {
        caption: 'Test post',
        mediaUrl: 'http://example.com/image.jpg',
      };
      const createdPost = { id: 'post-id', ...postData };

      mediaRepository.create.mockReturnValue(createdPost as any);
      mediaRepository.save.mockResolvedValue(createdPost as any);

      const result = await repository.createPost(postData);

      expect(mediaRepository.create).toHaveBeenCalledWith(postData);
      expect(mediaRepository.save).toHaveBeenCalledWith(createdPost);
      expect(result).toEqual(createdPost);
    });
  });

  describe('getAccountByUserId', () => {
    it('should find account by user ID with tenant ID', async () => {
      const userId = 'user-123';
      const expectedAccount = {
        id: userId,
        instagramAccountId: userId,
        username: 'testuser',
      };

      accountRepository.findOne.mockResolvedValue(expectedAccount as any);

      const result = await repository.getAccountByUserId(userId);

      expect(accountRepository.findOne).toHaveBeenCalledWith({
        where: { instagramAccountId: userId, tenantId: 'test-tenant-id' },
        relations: ['socialAccount'],
      });
      expect(result).toEqual(expectedAccount);
    });
  });

  describe('getMediaInsights', () => {
    it('should get media insights within the specified timeframe', async () => {
      const mediaId = 'media-123';
      const timeframe = '7';
      const expectedMetrics = [{ id: 'metric-1', impressions: 100 }];

      jest.spyOn(Date.prototype, 'setDate').mockImplementation(() => 0);
      metricRepository.find.mockResolvedValue(expectedMetrics as any);

      const result = await repository.getMediaInsights(mediaId, timeframe);

      expect(metricRepository.find).toHaveBeenCalled();
      expect(result).toEqual(expectedMetrics);
    });
  });

  describe('createAuthState', () => {
    it('should create a new auth state and return the state string', async () => {
      const userId = 'user-123';
      const mockState = 'mock-state-value';
      const expectedAuthState = {
        state: mockState,
        userId,
        platform: SocialPlatform.INSTAGRAM,
        expiresAt: expect.any(Date),
      };

      authStateRepository.create.mockReturnValue(expectedAuthState as any);
      authStateRepository.save.mockResolvedValue(expectedAuthState as any);

      const result = await repository.createAuthState(userId);

      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      expect(authStateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          state: mockState,
          userId,
          platform: SocialPlatform.INSTAGRAM,
        }),
      );
      expect(authStateRepository.save).toHaveBeenCalledWith(expectedAuthState);
      expect(result).toEqual(mockState);
    });
  });

  describe('getTopPerformingMedia', () => {
    it('should return top performing media for an account', async () => {
      const accountId = 'account-123';
      const limit = 5;
      const expectedMedia = [{ id: 'media-1', engagementRate: 0.5 }];

      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(expectedMedia),
      };

      mediaRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      const result = await repository.getTopPerformingMedia(accountId, limit);

      expect(mediaRepository.createQueryBuilder).toHaveBeenCalledWith('media');
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'media.metrics',
        'metrics',
      );
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'media.account.id = :accountId',
        { accountId },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'metrics.engagementRate',
        'DESC',
      );
      expect(queryBuilder.take).toHaveBeenCalledWith(limit);
      expect(result).toEqual(expectedMedia);
    });

    it('should use default limit of 10 if not specified', async () => {
      const accountId = 'account-123';
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mediaRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      await repository.getTopPerformingMedia(accountId);

      expect(queryBuilder.take).toHaveBeenCalledWith(10);
    });
  });

  describe('getActiveAccounts', () => {
    it('should return active accounts with non-expired tokens', async () => {
      const activeAccounts = [{ id: 'account-1', username: 'active-user' }];

      accountRepository.find.mockResolvedValue(activeAccounts as any);

      const result = await repository.getActiveAccounts();

      expect(accountRepository.find).toHaveBeenCalledWith({
        where: {
          tenantId: 'test-tenant-id',
          socialAccount: {
            tokenExpiresAt: MoreThan(expect.any(Date)),
          },
        },
        relations: ['socialAccount'],
      });
      expect(result).toEqual(activeAccounts);
    });
  });

  describe('getRecentMedia', () => {
    it('should return recent media for an account', async () => {
      const accountId = 'account-123';
      const days = 14;
      const recentMedia = [{ id: 'media-1', caption: 'Recent post' }];

      jest.spyOn(Date.prototype, 'setDate').mockImplementation(() => 0);
      mediaRepository.find.mockResolvedValue(recentMedia as any);

      const result = await repository.getRecentMedia(accountId, days);

      expect(mediaRepository.find).toHaveBeenCalledWith({
        where: {
          tenantId: 'test-tenant-id',
          account: { id: accountId },
          postedAt: MoreThan(expect.any(Date)),
        },
        relations: ['metrics'],
        order: { postedAt: 'DESC' },
      });
      expect(result).toEqual(recentMedia);
    });

    it('should use default of 30 days if not specified', async () => {
      const accountId = 'account-123';

      jest.spyOn(Date.prototype, 'setDate').mockImplementation(() => 0);
      mediaRepository.find.mockResolvedValue([]);

      await repository.getRecentMedia(accountId);

      expect(mediaRepository.find).toHaveBeenCalled();
      // Can't directly test the MoreThan date calculation, but we covered the default param
    });
  });

  describe('upsertMediaMetrics', () => {
    it('should update metrics if they already exist for the given date', async () => {
      const mediaId = 'media-123';
      const metrics = {
        impressions: 500,
        engagement: 50,
        collectedAt: new Date(),
      };
      const existingMetric = {
        id: 'metric-1',
        ...metrics,
      };
      const updatedMetric = {
        ...existingMetric,
        impressions: 500,
        updatedAt: expect.any(Date),
      };

      metricRepository.findOne.mockResolvedValueOnce(existingMetric as any);
      metricRepository.update.mockResolvedValueOnce({ affected: 1 } as any);
      metricRepository.findOne.mockResolvedValueOnce(updatedMetric as any);

      const result = await repository.upsertMediaMetrics(mediaId, metrics);

      expect(metricRepository.findOne).toHaveBeenCalledWith({
        where: {
          media: { id: mediaId },
          tenantId: 'test-tenant-id',
          collectedAt: metrics.collectedAt,
        },
      });
      expect(metricRepository.update).toHaveBeenCalledWith(existingMetric.id, {
        ...metrics,
        updatedAt: expect.any(Date),
      });
      expect(result).toEqual(updatedMetric);
    });

    it('should create new metrics if they do not exist for the given date', async () => {
      const mediaId = 'media-123';
      const metrics = {
        impressions: 500,
        engagement: 50,
        collectedAt: new Date(),
      };
      const newMetric = {
        id: 'metric-2',
        media: { id: mediaId },
        ...metrics,
      };

      metricRepository.findOne.mockResolvedValueOnce(null);
      metricRepository.create.mockReturnValueOnce(newMetric as any);
      metricRepository.save.mockResolvedValueOnce(newMetric as any);

      const result = await repository.upsertMediaMetrics(mediaId, metrics);

      expect(metricRepository.create).toHaveBeenCalledWith({
        media: { id: mediaId },
        ...metrics,
      });
      expect(metricRepository.save).toHaveBeenCalledWith(newMetric);
      expect(result).toEqual(newMetric);
    });
  });

  describe('updateAccountMetrics', () => {
    it('should update account metrics and return the updated account', async () => {
      const accountId = 'account-123';
      const metrics = {
        followers: 1000,
        following: 500,
        mediaCount: 50,
      };
      const updatedAccount = {
        id: accountId,
        followerCount: metrics.followers,
        followingCount: metrics.following,
        mediaCount: metrics.mediaCount,
        updatedAt: expect.any(Date),
      };

      accountRepository.update.mockResolvedValueOnce({ affected: 1 } as any);
      accountRepository.findOne.mockResolvedValueOnce(updatedAccount as any);

      const result = await repository.updateAccountMetrics(accountId, metrics);

      expect(accountRepository.update).toHaveBeenCalledWith(accountId, {
        followerCount: metrics.followers,
        followingCount: metrics.following,
        mediaCount: metrics.mediaCount,
        updatedAt: expect.any(Date),
      });
      expect(accountRepository.findOne).toHaveBeenCalledWith({
        where: { id: accountId, tenantId: 'test-tenant-id' },
        relations: ['socialAccount'],
      });
      expect(result).toEqual(updatedAccount);
    });
  });

  describe('getAccountsWithExpiringTokens', () => {
    it('should return accounts with tokens expiring within 24 hours', async () => {
      const expiringAccounts = [{ id: 'account-1', username: 'expiring-user' }];

      accountRepository.find.mockResolvedValue(expiringAccounts as any);

      const result = await repository.getAccountsWithExpiringTokens();

      expect(accountRepository.find).toHaveBeenCalledWith({
        where: {
          tenantId: 'test-tenant-id',
          socialAccount: {
            tokenExpiresAt: LessThan(expect.any(Date)),
          },
        },
        relations: ['socialAccount'],
      });
      expect(result).toEqual(expiringAccounts);
    });
  });

  describe('checkRateLimit', () => {
    it('should return true if below rate limit', async () => {
      const accountId = 'account-123';
      const action = 'API_CALLS';

      rateLimitRepository.count.mockResolvedValue(100); // Below the 200 limit

      const result = await repository.checkRateLimit(accountId, action);

      expect(rateLimitRepository.count).toHaveBeenCalledWith({
        where: {
          account: { id: accountId },
          action,
          createdAt: MoreThan(expect.any(Date)),
        },
      });
      expect(result).toBe(true);
    });

    it('should return false if at or above rate limit', async () => {
      const accountId = 'account-123';
      const action = 'API_CALLS';

      rateLimitRepository.count.mockResolvedValue(200); // At the 200 limit

      const result = await repository.checkRateLimit(accountId, action);

      expect(result).toBe(false);
    });
  });

  describe('recordRateLimitUsage', () => {
    it('should create and save a rate limit usage record', async () => {
      const accountId = 'account-123';
      const action = 'API_CALLS';
      const rateLimitRecord = {
        account: { id: accountId },
        action,
      };

      rateLimitRepository.create.mockReturnValue(rateLimitRecord as any);

      await repository.recordRateLimitUsage(accountId, action);

      expect(rateLimitRepository.create).toHaveBeenCalledWith({
        account: { id: accountId },
        action,
      });
      expect(rateLimitRepository.save).toHaveBeenCalledWith(rateLimitRecord);
    });
  });

  describe('updateAccountTokens', () => {
    it('should update social account tokens and return updated instagram account', async () => {
      const accountId = 'account-123';
      const tokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(),
      };
      const socialAccount = { id: 'social-123' };
      const account = {
        id: accountId,
        socialAccount,
      };

      accountRepository.findOne.mockResolvedValueOnce(account as any);
      entityManager.update.mockResolvedValueOnce({ affected: 1 } as any);

      // Mock the getAccountByUserId method
      jest
        .spyOn(repository, 'getAccountByUserId')
        .mockResolvedValueOnce(account as any);

      const result = await repository.updateAccountTokens(accountId, tokens);

      expect(accountRepository.findOne).toHaveBeenCalledWith({
        where: { id: accountId, tenantId: 'test-tenant-id' },
        relations: ['socialAccount'],
      });
      expect(entityManager.update).toHaveBeenCalledWith(
        SocialAccount,
        socialAccount.id,
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          updatedAt: expect.any(Date),
        },
      );
      expect(repository.getAccountByUserId).toHaveBeenCalledWith(accountId);
      expect(result).toEqual(account);
    });

    it('should throw NotFoundException if account not found', async () => {
      const accountId = 'account-123';
      const tokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(),
      };

      accountRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        repository.updateAccountTokens(accountId, tokens),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if social account not found', async () => {
      const accountId = 'account-123';
      const tokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(),
      };
      const account = { id: accountId, socialAccount: null };

      accountRepository.findOne.mockResolvedValueOnce(account as any);

      await expect(
        repository.updateAccountTokens(accountId, tokens),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAccount', () => {
    it('should delete account and associated data in a transaction', async () => {
      const accountId = 'account-123';
      const socialAccount = { id: 'social-123' };
      const account = { id: accountId, socialAccount };

      accountRepository.findOne.mockResolvedValueOnce(account as any);

      // Mock the transaction function to execute the callback
      entityManager.transaction.mockImplementation(async (callback) => {
        await callback(entityManager);
      });

      await repository.deleteAccount(accountId);

      expect(accountRepository.findOne).toHaveBeenCalledWith({
        where: { id: accountId, tenantId: 'test-tenant-id' },
        relations: ['socialAccount'],
      });
      expect(entityManager.transaction).toHaveBeenCalled();
      expect(entityManager.delete).toHaveBeenCalledWith(InstagramPost, {
        account: { id: accountId },
      });
      expect(entityManager.remove).toHaveBeenCalledWith(socialAccount);
      expect(entityManager.remove).toHaveBeenCalledWith(account);
    });

    it('should throw NotFoundException if account not found', async () => {
      const accountId = 'account-123';

      accountRepository.findOne.mockResolvedValueOnce(null);

      await expect(repository.deleteAccount(accountId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
