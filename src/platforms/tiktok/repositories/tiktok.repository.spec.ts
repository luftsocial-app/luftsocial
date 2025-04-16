import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, UpdateResult } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { TikTokRepository } from './tiktok.repository';
import { TikTokAccount } from '../../entities/tiktok-entities/tiktok-account.entity';
import { TikTokVideo } from '../../entities/tiktok-entities/tiktok-video.entity';
import { TikTokMetric } from '../../entities/tiktok-entities/tiktok-metric.entity';
import { TikTokRateLimit } from '../../entities/tiktok-entities/tiktok_rate_limits.entity';
import { TikTokComment } from '../../entities/tiktok-entities/tiktok_comments.entity';
import {
  TikTokPostVideoStatus,
  TikTokVideoPrivacyLevel,
} from '../helpers/tiktok.interfaces';
import { SocialAccount } from '../../../platforms/entities/notifications/entity/social-account.entity';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';
import { TenantService } from '../../../user-management/tenant.service';

jest.mock('../../../user-management/tenant.service', () => ({
  TenantService: jest.fn().mockImplementation(() => ({
    getTenantId: jest.fn(),
    setTenantId: jest.fn(),
  })),
}));

describe('TikTokRepository', () => {
  let repository: TikTokRepository;
  let accountRepo: jest.Mocked<Repository<TikTokAccount>>;
  let socialAccountRepo: jest.Mocked<Repository<SocialAccount>>;
  let videoRepo: jest.Mocked<Repository<TikTokVideo>>;
  let metricRepo: jest.Mocked<Repository<TikTokMetric>>;
  let rateLimitRepo: jest.Mocked<Repository<TikTokRateLimit>>;
  let commentRepo: jest.Mocked<Repository<TikTokComment>>;
  let entityManager: jest.Mocked<EntityManager>;
  let tenantService: TenantService;
  let dataSource: DataSource;

  // Mock data
  const mockTenantId = 'tenant123';
  const mockAccountId = 'account123';
  const mockVideoId = 'video123';
  const mockPublishId = 'publish123';
  const mockMetricId = 'metric123';
  const mockCommentId = 'comment123';
  const mockSessionId = 'session123';
  const mockSocialAccountId = 'social123';

  const mockAccount = {
    id: mockAccountId,
    tenantId: mockTenantId,
    tiktokUserId: 'tiktok_user_123',
    accountName: 'Test TikTok Account',
    socialAccount: {
      id: mockSocialAccountId,
      accessToken: 'access_token_123',
      refreshToken: 'refresh_token_123',
      tokenExpiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    },
  };

  const mockVideo = {
    id: mockVideoId,
    tenantId: mockTenantId,
    account: mockAccount,
    publishId: mockPublishId,
    uploadUrl: 'https://upload.tiktok.com/video',
    status: 'PUBLISHED',
    title: 'Test Video',
    privacyLevel: TikTokVideoPrivacyLevel.PUBLIC_TO_EVERYONE,
    disableDuet: false,
    disableStitch: false,
    disableComment: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMetric = {
    id: mockMetricId,
    tenantId: mockTenantId,
    video: { id: mockVideoId },
    views: 1000,
    likes: 500,
    comments: 100,
    shares: 50,
    collectedAt: new Date(),
  };

  // const mockComment = {
  //   id: mockCommentId,
  //   tenantId: mockTenantId,
  //   video: { id: mockVideoId },
  //   platformCommentId: 'platform_comment_123',
  //   content: 'Great video!',
  //   authorId: 'author123',
  //   authorUsername: 'testuser',
  //   likeCount: 20,
  //   replyCount: 5,
  //   commentedAt: new Date(),
  // };

  const mockUploadSession = {
    id: mockSessionId,
    tenantId: mockTenantId,
    account: { id: mockAccountId },
    publishId: mockPublishId,
    uploadUrl: 'https://upload.tiktok.com/video',
    uploadParams: {},
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 7200000), // 2 hours from now
  } as any;

  // Create mock repositories
  const mockAccountRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockSocialAccountRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockVideoRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockMetricRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockRateLimitRepo = {
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
  };

  const mockCommentRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockEntityManager = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    transaction: jest.fn(
      async (
        isolationLevelOrCallback:
          | IsolationLevel
          | ((manager: EntityManager) => Promise<any>),
        maybeCallback?: (manager: EntityManager) => Promise<any>,
      ) => {
        const callback =
          typeof isolationLevelOrCallback === 'function'
            ? isolationLevelOrCallback
            : maybeCallback;

        if (callback) {
          await callback(mockEntityManager as unknown as EntityManager);
        }
      },
    ),
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue(mockAccountRepo),
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TikTokRepository,
        TenantService,
        {
          provide: getRepositoryToken(TikTokAccount),
          useValue: mockAccountRepo,
        },
        {
          provide: getRepositoryToken(SocialAccount),
          useValue: mockSocialAccountRepo,
        },
        {
          provide: getRepositoryToken(TikTokVideo),
          useValue: mockVideoRepo,
        },
        {
          provide: getRepositoryToken(TikTokMetric),
          useValue: mockMetricRepo,
        },
        {
          provide: getRepositoryToken(TikTokRateLimit),
          useValue: mockRateLimitRepo,
        },
        {
          provide: getRepositoryToken(TikTokComment),
          useValue: mockCommentRepo,
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

    repository = module.get<TikTokRepository>(TikTokRepository);
    accountRepo = module.get(getRepositoryToken(TikTokAccount)) as jest.Mocked<
      Repository<TikTokAccount>
    >;
    socialAccountRepo = module.get(
      getRepositoryToken(SocialAccount),
    ) as jest.Mocked<Repository<SocialAccount>>;
    videoRepo = module.get(getRepositoryToken(TikTokVideo)) as jest.Mocked<
      Repository<TikTokVideo>
    >;
    metricRepo = module.get(getRepositoryToken(TikTokMetric)) as jest.Mocked<
      Repository<TikTokMetric>
    >;
    rateLimitRepo = module.get(
      getRepositoryToken(TikTokRateLimit),
    ) as jest.Mocked<Repository<TikTokRateLimit>>;
    commentRepo = module.get(getRepositoryToken(TikTokComment)) as jest.Mocked<
      Repository<TikTokComment>
    >;
    entityManager = module.get(EntityManager) as jest.Mocked<EntityManager>;
    tenantService = module.get<TenantService>(TenantService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('createAccount', () => {
    it('should create a new TikTok account', async () => {
      const accountData = {
        tiktokUserId: 'tiktok_user_123',
        accountName: 'Test Account',
        tenantId: mockTenantId,
        socialAccount: {
          accessToken: 'access_token_123',
          refreshToken: 'refresh_token_123',
          tokenExpiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        },
      } as unknown as TikTokAccount;

      const mockSavedSocialAccount = {
        id: 'social123',
        ...accountData.socialAccount,
        tenantId: mockTenantId,
      };

      const mockSavedTikTokAccount = {
        id: mockAccountId,
        tiktokUserId: accountData.tiktokUserId,
        tenantId: mockTenantId,
        socialAccount: mockSavedSocialAccount,
      };

      // Mock the repository methods
      socialAccountRepo.create.mockReturnValue(mockSavedSocialAccount as any);
      accountRepo.create.mockReturnValue(mockSavedTikTokAccount as any);

      // Mock the transaction behavior
      // mockDataSource.transaction.mockImplementation(async (callback) => {
      //   return callback(mockEntityManager)
      // });

      mockDataSource.transaction.mockImplementation(async (callback) => {
        const manager = {
          save: jest
            .fn()
            .mockResolvedValueOnce(mockSavedSocialAccount)
            .mockResolvedValueOnce(mockSavedTikTokAccount),
        };
        return callback(manager);
      });
      // Call the method under test
      const result = await repository.createAccount(accountData);

      // Assertions
      expect(socialAccountRepo.create).toHaveBeenCalledWith({
        ...accountData.socialAccount,
        tenantId: mockTenantId,
      });
      expect(accountRepo.create).toHaveBeenCalledWith({
        tiktokUserId: accountData.tiktokUserId,
        accountName: 'Test Account',
        tenantId: mockTenantId,
        socialAccount: mockSavedSocialAccount,
      });
      expect(result).toEqual(mockSavedTikTokAccount);
    });
  });

  describe('createVideo', () => {
    it('should create a new TikTok video', async () => {
      const videoData = {
        account: mockAccount as unknown as TikTokAccount,
        publishId: mockPublishId,
        status: 'PENDING',
        title: 'Test Video',
        privacyLevel: TikTokVideoPrivacyLevel.PUBLIC_TO_EVERYONE,
      };

      videoRepo.create.mockReturnValue(videoData as TikTokVideo);
      videoRepo.save.mockResolvedValue({
        id: mockVideoId,
        ...videoData,
      } as TikTokVideo);

      const result = await repository.createVideo(videoData);

      expect(videoRepo.create).toHaveBeenCalledWith(videoData);
      expect(videoRepo.save).toHaveBeenCalledWith(videoData);
      expect(result).toEqual({ id: mockVideoId, ...videoData });
    });
  });

  describe('updateAccountTokens', () => {
    it('should update account tokens', async () => {
      const tokenData = {
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresAt: new Date(Date.now() + 7200000), // 2 hours from now
      };

      accountRepo.findOne.mockResolvedValue(
        mockAccount as unknown as TikTokAccount,
      );
      socialAccountRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Mock getById to return updated account
      jest.spyOn(repository, 'getById').mockResolvedValue({
        ...mockAccount,
        socialAccount: {
          ...mockAccount.socialAccount,
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          tokenExpiresAt: tokenData.expiresAt,
        },
      } as unknown as TikTokAccount);
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(mockTenantId);

      const result = await repository.updateAccountTokens(
        mockAccountId,
        tokenData,
      );

      expect(accountRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockAccountId, tenantId: mockTenantId },
        relations: ['socialAccount'],
      });

      expect(socialAccountRepo.update).toHaveBeenCalledWith(
        mockAccount.socialAccount.id,
        {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          tokenExpiresAt: tokenData.expiresAt,
          updatedAt: expect.any(Date),
        },
      );

      expect(result.socialAccount.accessToken).toBe(tokenData.accessToken);
      expect(result.socialAccount.refreshToken).toBe(tokenData.refreshToken);
    });

    it('should throw NotFoundException when account not found', async () => {
      accountRepo.findOne.mockResolvedValue(null);

      await expect(
        repository.updateAccountTokens(mockAccountId, {
          accessToken: 'new_access_token',
          refreshToken: 'new_refresh_token',
          expiresAt: new Date(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when socialAccount not found', async () => {
      const accountWithoutSocial = { ...mockAccount, socialAccount: null };
      accountRepo.findOne.mockResolvedValue(
        accountWithoutSocial as unknown as TikTokAccount,
      );

      await expect(
        repository.updateAccountTokens(mockAccountId, {
          accessToken: 'new_access_token',
          refreshToken: 'new_refresh_token',
          expiresAt: new Date(),
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMetrics', () => {
    it('should update existing metrics', async () => {
      const metricData = {
        views: 2000,
        likes: 1000,
        collectedAt: new Date(),
      };

      metricRepo.findOne.mockResolvedValue(
        mockMetric as unknown as TikTokMetric,
      );
      metricRepo.update.mockResolvedValue({ affected: 1 } as any);
      metricRepo.findOne
        .mockResolvedValueOnce(mockMetric as unknown as TikTokMetric)
        .mockResolvedValueOnce({
          ...mockMetric,
          ...metricData,
        } as unknown as TikTokMetric);
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(mockTenantId);

      const result = await repository.updateMetrics(mockVideoId, metricData);

      expect(metricRepo.findOne).toHaveBeenCalledWith({
        where: {
          video: { id: mockVideoId },
          collectedAt: metricData.collectedAt,
          tenantId: mockTenantId,
        },
      });

      expect(metricRepo.update).toHaveBeenCalledWith(mockMetric.id, metricData);
      expect(result).toEqual({ ...mockMetric, ...metricData });
    });

    it('should create new metrics when not found', async () => {
      const metricData = {
        views: 2000,
        likes: 1000,
        collectedAt: new Date(),
      };

      // First findOne returns null (metric not found)
      metricRepo.findOne.mockResolvedValueOnce(null);

      // Create and save new metric
      metricRepo.create.mockReturnValue({
        ...metricData,
        video: { id: mockVideoId },
      } as unknown as TikTokMetric);
      metricRepo.save.mockResolvedValue({
        id: 'new_metric',
        ...metricData,
        video: { id: mockVideoId },
      } as unknown as TikTokMetric);

      const result = await repository.updateMetrics(mockVideoId, metricData);

      expect(metricRepo.create).toHaveBeenCalledWith({
        ...metricData,
        video: { id: mockVideoId },
      });
      expect(metricRepo.save).toHaveBeenCalled();
      expect(result).toEqual({
        id: 'new_metric',
        ...metricData,
        video: { id: mockVideoId },
      });
    });
  });

  describe('createComment', () => {
    it('should create a comment', async () => {
      const commentData = {
        videoId: mockVideoId,
        platformCommentId: 'platform_comment_123',
        content: 'Great video!',
        authorId: 'author123',
        authorUsername: 'testuser',
        likeCount: 20,
        replyCount: 5,
        commentedAt: new Date(),
      };

      commentRepo.create.mockReturnValue({
        video: { id: commentData.videoId },
        platformCommentId: commentData.platformCommentId,
        content: commentData.content,
        authorId: commentData.authorId,
        authorUsername: commentData.authorUsername,
        likeCount: commentData.likeCount,
        replyCount: commentData.replyCount,
        commentedAt: commentData.commentedAt,
      } as TikTokComment);

      commentRepo.save.mockResolvedValue({
        id: mockCommentId,
        video: { id: commentData.videoId },
        platformCommentId: commentData.platformCommentId,
        content: commentData.content,
        authorId: commentData.authorId,
        authorUsername: commentData.authorUsername,
        likeCount: commentData.likeCount,
        replyCount: commentData.replyCount,
        commentedAt: commentData.commentedAt,
      } as TikTokComment);

      const result = await repository.createComment(commentData);

      expect(commentRepo.create).toHaveBeenCalledWith({
        video: { id: commentData.videoId },
        platformCommentId: commentData.platformCommentId,
        content: commentData.content,
        authorId: commentData.authorId,
        authorUsername: commentData.authorUsername,
        likeCount: commentData.likeCount,
        replyCount: commentData.replyCount,
        commentedAt: commentData.commentedAt,
      });

      expect(commentRepo.save).toHaveBeenCalled();
      expect(result.id).toBe(mockCommentId);
    });

    it('should use default values for likeCount and replyCount', async () => {
      const commentData = {
        videoId: mockVideoId,
        platformCommentId: 'platform_comment_123',
        content: 'Great video!',
        authorId: 'author123',
        authorUsername: 'testuser',
        commentedAt: new Date(),
      };

      commentRepo.create.mockReturnValue({
        video: { id: commentData.videoId },
        platformCommentId: commentData.platformCommentId,
        content: commentData.content,
        authorId: commentData.authorId,
        authorUsername: commentData.authorUsername,
        likeCount: 0,
        replyCount: 0,
        commentedAt: commentData.commentedAt,
      } as TikTokComment);

      commentRepo.save.mockResolvedValue({
        id: mockCommentId,
        video: { id: commentData.videoId },
        platformCommentId: commentData.platformCommentId,
        content: commentData.content,
        authorId: commentData.authorId,
        authorUsername: commentData.authorUsername,
        likeCount: 0,
        replyCount: 0,
        commentedAt: commentData.commentedAt,
      } as TikTokComment);

      await repository.createComment(commentData);

      expect(commentRepo.create).toHaveBeenCalledWith({
        video: { id: commentData.videoId },
        platformCommentId: commentData.platformCommentId,
        content: commentData.content,
        authorId: commentData.authorId,
        authorUsername: commentData.authorUsername,
        likeCount: 0,
        replyCount: 0,
        commentedAt: commentData.commentedAt,
      });
    });
  });

  describe('updateVideoStatus', () => {
    it('should update video status', async () => {
      const newStatus = 'PUBLISHED';

      videoRepo.update.mockResolvedValue({ affected: 1 } as any);
      videoRepo.findOne.mockResolvedValue({
        ...mockVideo,
        status: newStatus,
      } as unknown as TikTokVideo);
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(mockTenantId);

      const result = await repository.updateVideoStatus(
        mockPublishId,
        newStatus,
      );

      expect(videoRepo.update).toHaveBeenCalledWith(
        { publishId: mockPublishId },
        {
          status: newStatus,
          updatedAt: expect.any(Date),
        },
      );

      expect(videoRepo.findOne).toHaveBeenCalledWith({
        where: { publishId: mockPublishId, tenantId: mockTenantId },
      });

      expect(result.status).toBe(newStatus);
    });
  });

  describe('getAccountById', () => {
    it('should return account by id with default relations', async () => {
      accountRepo.findOne.mockResolvedValue(
        mockAccount as unknown as TikTokAccount,
      );
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(mockTenantId);

      const result = await repository.getAccountById(mockAccountId);

      expect(accountRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockAccountId, tenantId: mockTenantId },
        relations: [],
      });

      expect(result).toEqual(mockAccount);
    });

    it('should return account by id with specified relations', async () => {
      const relations = ['socialAccount', 'videos'];
      accountRepo.findOne.mockResolvedValue(
        mockAccount as unknown as TikTokAccount,
      );
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(mockTenantId);

      const result = await repository.getAccountById(mockAccountId, relations);

      expect(accountRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockAccountId, tenantId: mockTenantId },
        relations,
      });

      expect(result).toEqual(mockAccount);
    });
  });

  describe('getRecentVideos', () => {
    it('should return recent videos with default limit', async () => {
      videoRepo.find.mockResolvedValue([mockVideo] as unknown as TikTokVideo[]);
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(mockTenantId);

      const result = await repository.getRecentVideos(mockAccountId);

      expect(videoRepo.find).toHaveBeenCalledWith({
        where: { account: { id: mockAccountId, tenantId: mockTenantId } },
        order: { createdAt: 'DESC' },
        take: 10,
        relations: ['metrics'],
      });

      expect(result).toEqual([mockVideo]);
    });

    it('should return recent videos with specified limit', async () => {
      videoRepo.find.mockResolvedValue([mockVideo] as unknown as TikTokVideo[]);
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(mockTenantId);

      const result = await repository.getRecentVideos(mockAccountId, 5);

      expect(videoRepo.find).toHaveBeenCalledWith({
        where: { account: { id: mockAccountId, tenantId: mockTenantId } },
        order: { createdAt: 'DESC' },
        take: 5,
        relations: ['metrics'],
      });

      expect(result).toEqual([mockVideo]);
    });
  });

  describe('getActiveAccounts', () => {
    it('should return active accounts', async () => {
      accountRepo.find.mockResolvedValue([
        mockAccount,
      ] as unknown as TikTokAccount[]);
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(mockTenantId);

      const result = await repository.getActiveAccounts();

      expect(accountRepo.find).toHaveBeenCalledWith({
        where: {
          tenantId: mockTenantId,
          socialAccount: {
            tokenExpiresAt: expect.any(Object), // MoreThan(new Date())
          },
        },
        relations: ['socialAccount'],
      });

      expect(result).toEqual([mockAccount]);
    });
  });

  describe('createVideoMetrics', () => {
    it('should create video metrics', async () => {
      const metricsData = {
        videoId: mockVideoId,
        metrics: {
          viewCount: 1000,
          likeCount: 500,
          commentCount: 100,
          sharesCount: 50,
        },
      };

      metricRepo.create.mockReturnValue({
        id: mockMetricId,
        video: { id: metricsData.videoId },
        ...metricsData.metrics,
        collectedAt: expect.any(Date),
      } as unknown as TikTokMetric);

      metricRepo.save.mockResolvedValue({
        id: mockMetricId,
        video: { id: metricsData.videoId },
        ...metricsData.metrics,
        collectedAt: expect.any(Date),
      } as unknown as TikTokMetric);

      const result = await repository.createVideoMetrics(metricsData);

      expect(metricRepo.create).toHaveBeenCalledWith({
        video: { id: metricsData.videoId },
        ...metricsData.metrics,
        collectedAt: expect.any(Date),
      });

      expect(metricRepo.save).toHaveBeenCalled();
      expect(result.id).toBe(mockMetricId);
    });
  });

  describe('getAccountsWithExpiringTokens', () => {
    it('should return accounts with expiring tokens', async () => {
      accountRepo.find.mockResolvedValue([
        mockAccount,
      ] as unknown as TikTokAccount[]);
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(mockTenantId);

      const result = await repository.getAccountsWithExpiringTokens();

      expect(accountRepo.find).toHaveBeenCalledWith({
        where: {
          tenantId: mockTenantId,
          socialAccount: {
            tokenExpiresAt: expect.any(Object), // LessThan(expirationThreshold)
          },
        },
        relations: ['socialAccount'],
      });

      expect(result).toEqual([mockAccount]);
    });
  });

  describe('updateUploadSession', () => {
    it('should update upload session status', async () => {
      entityManager.update.mockResolvedValue({
        affected: 1,
      } as unknown as UpdateResult);

      await repository.updateUploadSession(mockSessionId, 'COMPLETED');

      expect(entityManager.update).toHaveBeenCalledWith(
        'tiktok_upload_sessions',
        mockSessionId,
        {
          status: 'COMPLETED',
          updatedAt: expect.any(Date),
        },
      );
    });
  });

  describe('checkRateLimit', () => {
    it('should return true when under rate limit', async () => {
      rateLimitRepo.count.mockResolvedValue(5);

      const result = await repository.checkRateLimit(
        mockAccountId,
        'API_CALLS',
      );

      expect(rateLimitRepo.count).toHaveBeenCalledWith({
        where: {
          account: { id: mockAccountId },
          action: 'API_CALLS',
          createdAt: expect.any(Object), // MoreThan(timeWindow)
        },
      });

      expect(result).toBe(true);
    });

    it('should return false when over rate limit', async () => {
      rateLimitRepo.count.mockResolvedValue(250); // Over API_CALLS limit of 200

      const result = await repository.checkRateLimit(
        mockAccountId,
        'API_CALLS',
      );

      expect(result).toBe(false);
    });
  });

  describe('recordRateLimitUsage', () => {
    it('should record rate limit usage', async () => {
      rateLimitRepo.create.mockReturnValue({
        account: { id: mockAccountId },
        action: 'API_CALLS',
        createdAt: expect.any(Date),
      } as TikTokRateLimit);

      rateLimitRepo.save.mockResolvedValue({
        id: 'rate_limit_123',
        account: { id: mockAccountId },
        action: 'API_CALLS',
        createdAt: expect.any(Date),
      } as TikTokRateLimit);

      await repository.recordRateLimitUsage(mockAccountId, 'API_CALLS');

      expect(rateLimitRepo.create).toHaveBeenCalledWith({
        account: { id: mockAccountId },
        action: 'API_CALLS',
        createdAt: expect.any(Date),
      });

      expect(rateLimitRepo.save).toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('should return account by id', async () => {
      accountRepo.findOne.mockResolvedValue(
        mockAccount as unknown as TikTokAccount,
      );
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(mockTenantId);

      const result = await repository.getById(mockAccountId);

      expect(accountRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockAccountId, tenantId: mockTenantId },
        relations: ['socialAccount'],
      });

      expect(result).toEqual(mockAccount);
    });
  });

  describe('createUploadSession', () => {
    it('should create upload session', async () => {
      const sessionData = {
        accountId: mockAccountId,
        publishId: mockPublishId,
        uploadUrl: 'https://upload.tiktok.com/video',
        uploadParams: {},
        status: TikTokPostVideoStatus.PENDING,
        expiresAt: new Date(Date.now() + 7200000), // 2 hours from now
      };

      entityManager.create.mockReturnValue(mockUploadSession);
      entityManager.save.mockResolvedValue({
        id: mockSessionId,
        ...mockUploadSession,
      });

      const result = await repository.createUploadSession(sessionData);

      expect(entityManager.create).toHaveBeenCalledWith(
        'tiktok_upload_sessions',
        {
          account: { id: sessionData.accountId },
          publishId: sessionData.publishId,
          uploadUrl: sessionData.uploadUrl,
          uploadParams: sessionData.uploadParams,
          status: sessionData.status,
          expiresAt: sessionData.expiresAt,
        },
      );

      expect(entityManager.save).toHaveBeenCalledWith(
        'tiktok_upload_sessions',
        mockUploadSession,
      );
      expect(result).toEqual({ id: mockSessionId, ...mockUploadSession });
    });
  });

  describe('getUploadSession', () => {
    it('should return upload session by id', async () => {
      entityManager.findOne.mockResolvedValue(mockUploadSession);
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(mockTenantId);

      const result = await repository.getUploadSession(mockSessionId);

      expect(entityManager.findOne).toHaveBeenCalledWith(
        'tiktok_upload_sessions',
        {
          where: { id: mockSessionId, tenantId: mockTenantId },
        },
      );

      expect(result).toEqual(mockUploadSession);
    });
  });

  describe('deleteAccount', () => {
    it('should delete account and associated data', async () => {
      accountRepo.findOne.mockResolvedValue(
        mockAccount as unknown as TikTokAccount,
      );
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(mockTenantId);

      await repository.deleteAccount(mockAccountId);

      expect(accountRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockAccountId, tenantId: mockTenantId },
        relations: ['socialAccount'],
      });

      expect(entityManager.transaction).toHaveBeenCalled();
      expect(entityManager.delete).toHaveBeenCalledWith(TikTokVideo, {
        account: { id: mockAccountId, tenantId: mockTenantId },
      });

      expect(entityManager.remove).toHaveBeenCalledWith(
        mockAccount.socialAccount,
      );
      expect(entityManager.remove).toHaveBeenCalledWith(mockAccount);
    });

    it('should throw NotFoundException when account not found', async () => {
      accountRepo.findOne.mockResolvedValue(null);

      await expect(repository.deleteAccount(mockAccountId)).rejects.toThrow(
        NotFoundException,
      );
      expect(entityManager.transaction).not.toHaveBeenCalled();
    });

    it('should skip social account removal if not present', async () => {
      const accountWithoutSocial = { ...mockAccount, socialAccount: null };
      accountRepo.findOne.mockResolvedValue(
        accountWithoutSocial as unknown as TikTokAccount,
      );

      await repository.deleteAccount(mockAccountId);

      expect(entityManager.transaction).toHaveBeenCalled();
      expect(entityManager.remove).not.toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockAccount.socialAccount.id,
        }),
      );
      expect(entityManager.remove).toHaveBeenCalledWith(accountWithoutSocial);
    });
  });
});
