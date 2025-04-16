import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import * as crypto from 'crypto';
import { LinkedInAccount } from '../../entities/linkedin-entities/linkedin-account.entity';
import { LinkedInOrganization } from '../../entities/linkedin-entities/linkedin-organization.entity';
import { LinkedInMetric } from '../../entities/linkedin-entities/linkedin-metric.entity';
import { LinkedInPost } from '../../entities/linkedin-entities/linkedin-post.entity';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import { NotFoundException } from '@nestjs/common';
import { LinkedInRepository } from './linkedin.repository';
import { AuthState } from '../../entities/facebook-entities/auth-state.entity';
import { SocialAccount } from '../../../platforms/entities/notifications/entity/social-account.entity';
import { TenantService } from '../../../user-management/tenant.service';

// Mock for crypto.randomBytes
jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
}));

jest.mock('../../../user-management/tenant.service', () => ({
  TenantService: jest.fn().mockImplementation(() => ({
    getTenantId: jest.fn(),
    setTenantId: jest.fn(),
  })),
}));
describe('LinkedInRepository', () => {
  let repository: LinkedInRepository;
  let accountRepo: Repository<LinkedInAccount>;
  let orgRepo: Repository<LinkedInOrganization>;
  let postRepo: Repository<LinkedInPost>;
  let authStateRepo: Repository<AuthState>;
  let metricRepo: Repository<LinkedInMetric>;
  let entityManager: EntityManager;
  let tenantService: TenantService;

  // Mock tenant ID
  const TENANT_ID = 'test-tenant-id';

  // Setup mock data
  const mockAccount = {
    id: 'account-id',
    tenantId: TENANT_ID,
    socialAccount: {
      id: 'social-account-id',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenExpiresAt: new Date(),
    },
  } as unknown as LinkedInAccount;

  const mockOrganization = {
    id: 'org-id',
    tenantId: TENANT_ID,
    organizationId: 'linkedin-org-id',
    name: 'Test Organization',
    vanityName: 'test-org',
    description: 'Test description',
    account: mockAccount,
  } as unknown as LinkedInOrganization;

  const mockPost = {
    id: 'post-id',
    tenantId: TENANT_ID,
    publishedAt: new Date(),
    organization: mockOrganization,
  } as unknown as LinkedInPost;

  const mockMetric = {
    id: 'metric-id-1',
    impressions: 100,
    uniqueImpressions: 80,
    clicks: 30,
    likes: 50,
    comments: 20,
    shares: 10,
    engagementRate: 0.0375,
    industryData: { tech: 40, finance: 30 },
    collectedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as LinkedInMetric;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkedInRepository,
        TenantService,
        {
          provide: getRepositoryToken(LinkedInAccount),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(LinkedInOrganization),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(LinkedInPost),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(AuthState),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(LinkedInMetric),
          useFactory: mockRepository,
        },
        {
          provide: EntityManager,
          useFactory: mockEntityManager,
        },
      ],
    }).compile();

    repository = module.get<LinkedInRepository>(LinkedInRepository);
    accountRepo = module.get<Repository<LinkedInAccount>>(
      getRepositoryToken(LinkedInAccount),
    );
    orgRepo = module.get<Repository<LinkedInOrganization>>(
      getRepositoryToken(LinkedInOrganization),
    );
    postRepo = module.get<Repository<LinkedInPost>>(
      getRepositoryToken(LinkedInPost),
    );
    authStateRepo = module.get<Repository<AuthState>>(
      getRepositoryToken(AuthState),
    );
    metricRepo = module.get<Repository<LinkedInMetric>>(
      getRepositoryToken(LinkedInMetric),
    );
    entityManager = module.get<EntityManager>(EntityManager);
    tenantService = module.get<TenantService>(TenantService);
  });

  // Helper factory function to create mock repositories
  function mockRepository() {
    return {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      })),
    };
  }

  // Helper factory function to create mock entity manager
  function mockEntityManager() {
    return {
      update: jest.fn(),
      save: jest.fn(),
      transaction: jest.fn((cb) => cb(mockTransactionalEntityManager())),
      remove: jest.fn(),
      delete: jest.fn(),
    };
  }

  function mockTransactionalEntityManager() {
    return {
      remove: jest.fn(),
      delete: jest.fn(),
    };
  }

  // Reset all mocks before each test
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPost', () => {
    it('should create a new LinkedIn post', async () => {
      // Arrange
      const postData = {
        text: 'Test post',
        organizationId: 'org-id',
      } as unknown as LinkedInPost;
      const createdPost = {
        id: 'temp-id',
        ...postData,
      } as unknown as LinkedInPost;
      const savedPost = {
        id: 'new-post-id',
        ...postData,
      } as unknown as LinkedInPost;

      jest.spyOn(postRepo, 'create').mockReturnValue(createdPost);
      jest.spyOn(postRepo, 'save').mockResolvedValue(savedPost);

      // Act
      const result = await repository.createPost(postData);

      // Assert
      expect(postRepo.create).toHaveBeenCalledWith(postData);
      expect(postRepo.save).toHaveBeenCalledWith(createdPost);
      expect(result).toEqual(savedPost);
    });
  });

  describe('createAuthState', () => {
    it('should create a new auth state for a user', async () => {
      // Arrange
      const userId = 'user-id';
      const mockState = 'random-state-string';
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue(mockState),
      });

      jest.spyOn(entityManager, 'save').mockResolvedValue({ state: mockState });

      // Act
      const result = await repository.createAuthState(userId);

      // Assert
      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      expect(entityManager.save).toHaveBeenCalledWith('auth_states', {
        state: mockState,
        userId,
        platform: SocialPlatform.LINKEDIN,
        expiresAt: expect.any(Date),
      });
      expect(authStateRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockState);
    });
  });

  describe('getById', () => {
    it('should find a LinkedIn account by id with relations', async () => {
      // Arrange
      const accountId = 'account-id';
      jest.spyOn(accountRepo, 'findOne').mockResolvedValue(mockAccount);
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(TENANT_ID);
      // Act
      const result = await repository.getById(accountId);

      // Assert
      expect(accountRepo.findOne).toHaveBeenCalledWith({
        where: { id: accountId, tenantId: TENANT_ID },
        relations: [
          'socialAccount',
          'organizations',
          'organizations.posts',
          'organizations.posts.metrics',
        ],
      });
      expect(result).toEqual(mockAccount);
    });
  });

  describe('getOrganizationMetrics', () => {
    it('should retrieve and aggregate metrics for an organization', async () => {
      // Arrange
      const orgId = 'org-id';
      const timeframe = '30';
      const mockMetrics = [mockMetric, { ...mockMetric, id: 'metric-id-2' }];

      // Mock the query builder chain
      const queryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockMetrics),
      } as unknown as SelectQueryBuilder<LinkedInMetric>;

      jest
        .spyOn(metricRepo, 'createQueryBuilder')
        .mockReturnValue(queryBuilder);

      // Act
      const result = await repository.getOrganizationMetrics(orgId, timeframe);

      // Assert
      expect(metricRepo.createQueryBuilder).toHaveBeenCalledWith('metric');
      expect(queryBuilder.leftJoin).toHaveBeenCalledWith('metric.post', 'post');
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'post.organization.id = :orgId',
        { orgId },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'metric.collectedAt > :timeAgo',
        { timeAgo: expect.any(Date) },
      );
      expect(result).toEqual({
        totalImpressions: 200,
        totalEngagements: 160, // (50 + 20 + 10) * 2 = 160
        avgEngagementRate: 0.0375, // Assuming both metrics have the same engagementRate
        industries: { tech: 40, finance: 30 },
      });
    });
  });

  describe('getAccountsNearingExpiration', () => {
    it('should find accounts with tokens expiring within 24 hours', async () => {
      // Arrange
      const mockAccounts = [mockAccount];
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(TENANT_ID);

      jest.spyOn(accountRepo, 'find').mockResolvedValue(mockAccounts);

      // Act
      const result = await repository.getAccountsNearingExpiration();

      // Assert
      expect(accountRepo.find).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          socialAccount: {
            tokenExpiresAt: expect.anything(),
          },
        },
        relations: ['socialAccount'],
      });
      expect(result).toEqual(mockAccounts);
    });
  });

  describe('updateAccountTokens', () => {
    it('should update access token information for an account', async () => {
      // Arrange
      const accountId = 'account-id';
      const tokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(),
      };
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(TENANT_ID);

      jest.spyOn(accountRepo, 'findOne').mockResolvedValue(mockAccount);

      // Mock the getById call that happens after update
      repository.getById = jest.fn().mockResolvedValue({
        ...mockAccount,
        socialAccount: {
          ...mockAccount.socialAccount,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
        },
      });

      // Act
      const result = await repository.updateAccountTokens(accountId, tokens);

      // Assert
      expect(accountRepo.findOne).toHaveBeenCalledWith({
        where: { id: accountId, tenantId: TENANT_ID },
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
      expect(repository.getById).toHaveBeenCalledWith(accountId);
      expect(result.socialAccount.accessToken).toEqual(tokens.accessToken);
    });

    it('should throw NotFoundException when account not found', async () => {
      // Arrange
      const accountId = 'nonexistent-id';
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(TENANT_ID);

      jest.spyOn(accountRepo, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(
        repository.updateAccountTokens(accountId, {
          accessToken: 'new-token',
          expiresAt: new Date(),
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRecentPosts', () => {
    it('should retrieve recent posts for an organization', async () => {
      // Arrange
      const orgId = 'org-id';
      const days = 15;
      const mockPosts = [mockPost] as unknown as LinkedInPost[];
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(TENANT_ID);

      jest.spyOn(postRepo, 'find').mockResolvedValue(mockPosts);

      // Act
      const result = await repository.getRecentPosts(orgId, days);

      // Assert
      expect(postRepo.find).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          organization: { id: orgId },
          publishedAt: expect.anything(),
        },
        relations: ['metrics'],
        order: { publishedAt: 'DESC' },
      });
      expect(result).toEqual(mockPosts);
    });

    it('should use default 30 days when not specified', async () => {
      // Arrange
      const orgId = 'org-id';
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(TENANT_ID);

      jest.spyOn(postRepo, 'find').mockResolvedValue([mockPost]);

      // Act
      await repository.getRecentPosts(orgId);

      // Assert - checking the default parameter usage
      const whereClause = postRepo.find['mock']['calls'][0][0].where;
      expect(whereClause.organization.id).toEqual(orgId);
      expect(whereClause.publishedAt).toBeDefined(); // Can't directly test MoreThan constructor
    });
  });

  describe('upsertMetrics', () => {
    it('should update metrics when they already exist', async () => {
      // Arrange
      const postId = 'post-id';
      const metricData = {
        impressions: 100,
        likes: 75,
        collectedAt: new Date(),
      };

      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(TENANT_ID);

      jest
        .spyOn(metricRepo, 'findOne')
        .mockResolvedValueOnce(mockMetric)
        .mockResolvedValueOnce(mockMetric)
        .mockResolvedValueOnce({
          // Second call after update
          ...mockMetric,
          impressions: metricData.impressions,
          likes: metricData.likes,
        });

      // Act
      const result = await repository.upsertMetrics(postId, metricData);

      // Assert
      expect(metricRepo.findOne).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          post: { id: postId },
          collectedAt: metricData.collectedAt,
        },
      });
      expect(metricRepo.update).toHaveBeenCalledWith(mockMetric.id, {
        ...metricData,
        updatedAt: expect.any(Date),
      });
      expect(result.impressions).toEqual(metricData.impressions);
    });

    it('should create new metrics when they do not exist', async () => {
      // Arrange
      const postId = 'post-id';
      const metricData = {
        impressions: 150,
        likes: 75,
        collectedAt: new Date(),
      };
      const newMetric = {
        id: 'new-metric-id',
        ...metricData,
      } as unknown as LinkedInMetric;

      jest.spyOn(metricRepo, 'create').mockReturnValue(newMetric);
      jest.spyOn(metricRepo, 'save').mockResolvedValue(newMetric);
      jest.spyOn(metricRepo, 'findOne').mockResolvedValue(null);

      // Act
      const result = await repository.upsertMetrics(postId, metricData);

      // Assert
      expect(metricRepo.create).toHaveBeenCalledWith({
        post: { id: postId },
        ...metricData,
      });
      expect(metricRepo.save).toHaveBeenCalledWith(newMetric);
      expect(result).toEqual(newMetric);
    });
  });

  describe('getActiveOrganizations', () => {
    it('should retrieve organizations with valid access tokens', async () => {
      // Arrange
      const mockOrgs = [mockOrganization] as unknown as LinkedInOrganization[];

      jest.spyOn(orgRepo, 'find').mockResolvedValue(mockOrgs);
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(TENANT_ID);

      // Act
      const result = await repository.getActiveOrganizations();

      // Assert
      expect(orgRepo.find).toHaveBeenCalledWith({
        where: {
          account: {
            tenantId: TENANT_ID,
            socialAccount: {
              tokenExpiresAt: expect.anything(),
            },
          },
        },
        relations: ['account', 'account.socialAccount'],
      });
      expect(result).toEqual(mockOrgs);
    });
  });

  describe('upsertOrganization', () => {
    it('should update an organization when it already exists', async () => {
      // Arrange
      const orgData = {
        account: mockAccount,
        organizationId: 'linkedin-org-id',
        name: 'Updated Org Name',
        vanityName: 'updated-org',
        description: 'Updated description',
      };

      jest
        .spyOn(orgRepo, 'findOne')
        .mockResolvedValue(mockOrganization)
        .mockResolvedValueOnce(mockOrganization)
        .mockResolvedValueOnce({
          // Second call after update
          ...mockOrganization,
          name: orgData.name,
          vanityName: orgData.vanityName,
          description: orgData.description,
        });

      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(TENANT_ID);

      // Act
      const result = await repository.upsertOrganization(orgData);

      // Assert
      expect(orgRepo.findOne).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          account: { id: mockAccount.id },
          organizationId: orgData.organizationId,
        },
      });
      expect(orgRepo.update).toHaveBeenCalledWith(mockOrganization.id, {
        name: orgData.name,
        vanityName: orgData.vanityName,
        description: orgData.description,
        updatedAt: expect.any(Date),
      });
      expect(result.name).toEqual(orgData.name);
    });

    it('should create a new organization when it does not exist', async () => {
      // Arrange
      const orgData = {
        account: mockAccount,
        organizationId: 'new-linkedin-org-id',
        name: 'New Organization',
      };
      const newOrg = {
        id: 'new-org-id',
        ...orgData,
      } as unknown as LinkedInOrganization;

      jest.spyOn(orgRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(orgRepo, 'create').mockReturnValue(newOrg);
      jest.spyOn(orgRepo, 'save').mockResolvedValue(newOrg);

      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(TENANT_ID);

      // Act
      const result = await repository.upsertOrganization(orgData);

      // Assert
      expect(orgRepo.create).toHaveBeenCalledWith(orgData);
      expect(orgRepo.save).toHaveBeenCalledWith(newOrg);
      expect(result).toEqual(newOrg);
    });
  });

  describe('deleteAccount', () => {
    it('should delete an account and associated entities in a transaction', async () => {
      // Arrange
      const accountId = 'account-id';
      jest.spyOn(accountRepo, 'findOne').mockResolvedValue(mockAccount);
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(TENANT_ID);

      // Act
      await repository.deleteAccount(accountId);

      // Assert
      expect(accountRepo.findOne).toHaveBeenCalledWith({
        where: { id: accountId, tenantId: TENANT_ID },
        relations: ['socialAccount'],
      });
      expect(entityManager.transaction).toHaveBeenCalled();
      // Unfortunately can't easily test the transaction callback's implementation details directly
    });

    it('should throw NotFoundException when account not found', async () => {
      // Arrange
      const accountId = 'nonexistent-id';
      jest.spyOn(accountRepo, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(repository.deleteAccount(accountId)).rejects.toThrow(
        NotFoundException,
      );
      expect(entityManager.transaction).not.toHaveBeenCalled();
    });
  });
});
