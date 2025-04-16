import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  LessThan,
  MoreThan,
  Repository,
} from 'typeorm';
import { TikTokAccount } from '../../entities/tiktok-entities/tiktok-account.entity';
import { TikTokVideo } from '../../entities/tiktok-entities/tiktok-video.entity';
import { TikTokMetric } from '../../entities/tiktok-entities/tiktok-metric.entity';
import { TikTokRateLimit } from '../../entities/tiktok-entities/tiktok_rate_limits.entity';
import { TikTokComment } from '../../entities/tiktok-entities/tiktok_comments.entity';
import {
  CreateUploadSessionParams,
  TikTokVideoPrivacyLevel,
} from '../helpers/tiktok.interfaces';
import { SocialAccount } from '../../../platforms/entities/notifications/entity/social-account.entity';
import { TenantService } from '../../../user-management/tenant.service';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class TikTokRepository {
  constructor(
    @InjectRepository(TikTokAccount)
    private readonly accountRepo: Repository<TikTokAccount>,
    @InjectRepository(SocialAccount)
    private readonly socialAccountRepo: Repository<SocialAccount>,
    @InjectRepository(TikTokVideo)
    private readonly videoRepo: Repository<TikTokVideo>,
    @InjectRepository(TikTokMetric)
    private readonly metricRepo: Repository<TikTokMetric>,
    @InjectRepository(TikTokRateLimit)
    private readonly rateLimitRepo: Repository<TikTokRateLimit>,
    @InjectRepository(TikTokComment)
    private readonly commentRepo: Repository<TikTokComment>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,

    private readonly tenantService: TenantService,
    private dataSource: DataSource,
    private readonly logger: PinoLogger,
  ) {}

  async createAccount(data: Partial<TikTokAccount>): Promise<TikTokAccount> {
    const socialAccountData = data.socialAccount;

    const { socialAccount, ...tiktokAccountData } = data;

    this.logger.info({ socialAccount, tiktokAccountData });

    return this.dataSource.transaction(async (manager) => {
      this.logger.info('here');

      // First create the social account
      const socialAccount = this.socialAccountRepo.create({
        ...socialAccountData,
        tenantId: data.tenantId, // Ensure tenantId is set
      });

      const savedSocialAccount = await manager.save(socialAccount);

      this.logger.info({ savedSocialAccount });

      // Now create the TikTok account with a reference to the social account
      const tiktokAccount = this.accountRepo.create({
        ...tiktokAccountData,
        socialAccount: savedSocialAccount,
      });

      return await manager.save(tiktokAccount);
    });
  }

  async createVideo(data: {
    account: TikTokAccount;
    publishId: string;
    uploadUrl?: string;
    status: string;
    title?: string;
    privacyLevel: TikTokVideoPrivacyLevel;
    disableDuet?: boolean;
    disableStitch?: boolean;
    disableComment?: boolean;
    videoCoverTimestampMs?: number;
    brandContentToggle?: boolean;
    brandOrganicToggle?: boolean;
    isAigc?: boolean;
  }): Promise<TikTokVideo> {
    const video = this.videoRepo.create(data);
    return this.videoRepo.save(video);
  }

  async updateAccountTokens(
    accountId: string,
    tokenData: {
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
    },
  ): Promise<TikTokAccount> {
    const account = await this.accountRepo.findOne({
      where: { id: accountId, tenantId: this.tenantService.getTenantId() },
      relations: ['socialAccount'],
    });

    if (!account?.socialAccount) {
      throw new NotFoundException('Account not found');
    }

    // Update the social account token information
    await this.socialAccountRepo.update(account.socialAccount.id, {
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      tokenExpiresAt: tokenData.expiresAt,
      updatedAt: new Date(),
    });

    return this.getById(accountId);
  }

  async updateMetrics(
    videoId: string,
    data: Partial<TikTokMetric>,
  ): Promise<TikTokMetric> {
    const existing = await this.metricRepo.findOne({
      where: {
        video: { id: videoId },
        collectedAt: data.collectedAt,
        tenantId: this.tenantService.getTenantId(),
      },
    });

    if (existing) {
      await this.metricRepo.update(existing.id, data);
      return this.metricRepo.findOne({
        where: { id: existing.id, tenantId: this.tenantService.getTenantId() },
      });
    }

    const metric = this.metricRepo.create({ ...data, video: { id: videoId } });
    return this.metricRepo.save(metric);
  }

  async createComment(data: {
    videoId: string;
    platformCommentId: string;
    content: string;
    authorId: string;
    authorUsername: string;
    likeCount?: number;
    replyCount?: number;
    commentedAt: Date;
  }): Promise<TikTokComment> {
    const comment = this.commentRepo.create({
      video: { id: data.videoId },
      platformCommentId: data.platformCommentId,
      content: data.content,
      authorId: data.authorId,
      authorUsername: data.authorUsername,
      likeCount: data.likeCount || 0,
      replyCount: data.replyCount || 0,
      commentedAt: data.commentedAt,
    });

    return this.commentRepo.save(comment);
  }

  async updateVideoStatus(
    publishId: string,
    status: string,
  ): Promise<TikTokVideo> {
    await this.videoRepo.update(
      { publishId },
      {
        status,
        updatedAt: new Date(),
      },
    );
    return this.videoRepo.findOne({
      where: { publishId, tenantId: this.tenantService.getTenantId() },
    });
  }

  async getAccountById(
    id: string,
    relations: string[] = [],
  ): Promise<TikTokAccount> {
    return this.accountRepo.findOne({
      where: { id, tenantId: this.tenantService.getTenantId() },
      relations,
    });
  }

  async getRecentVideos(
    accountId: string,
    limit: number = 10,
  ): Promise<TikTokVideo[]> {
    return this.videoRepo.find({
      where: {
        account: { id: accountId, tenantId: this.tenantService.getTenantId() },
      },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['metrics'],
    });
  }

  async getActiveAccounts(): Promise<TikTokAccount[]> {
    return this.accountRepo.find({
      where: {
        tenantId: this.tenantService.getTenantId(),
        socialAccount: {
          tokenExpiresAt: MoreThan(new Date()),
        },
      },
      relations: ['socialAccount'],
    });
  }

  async createVideoMetrics(data: {
    videoId: string;
    metrics: Partial<TikTokMetric>;
  }): Promise<TikTokMetric> {
    const metric = this.metricRepo.create({
      video: { id: data.videoId },
      ...data.metrics,
      collectedAt: new Date(),
    });

    return this.metricRepo.save(metric);
  }

  async getAccountsWithExpiringTokens(): Promise<TikTokAccount[]> {
    const expirationThreshold = new Date();
    expirationThreshold.setHours(expirationThreshold.getHours() + 24);

    return this.accountRepo.find({
      where: {
        tenantId: this.tenantService.getTenantId(),
        socialAccount: {
          tokenExpiresAt: LessThan(expirationThreshold),
        },
      },
      relations: ['socialAccount'],
    });
  }

  async updateUploadSession(
    sessionId: string,
    status: 'PENDING' | 'COMPLETED' | 'FAILED',
  ): Promise<any> {
    return this.entityManager.update('tiktok_upload_sessions', sessionId, {
      status,
      updatedAt: new Date(),
    });
  }

  async checkRateLimit(accountId: string, action: string): Promise<boolean> {
    const timeWindow = new Date();
    timeWindow.setHours(timeWindow.getHours() - 1); // 1 hour window

    const count = await this.rateLimitRepo.count({
      where: {
        account: { id: accountId },
        action,
        createdAt: MoreThan(timeWindow),
      },
    });

    const limits = {
      API_CALLS: 200,
      VIDEO_UPLOAD: 10,
      COMMENTS: 50,
    };

    return count < (limits[action] || 0);
  }

  async recordRateLimitUsage(accountId: string, action: string): Promise<void> {
    const rateLimit = this.rateLimitRepo.create({
      account: { id: accountId },
      action,
      createdAt: new Date(),
    });

    await this.rateLimitRepo.save(rateLimit);
  }

  async getById(id: string): Promise<TikTokAccount> {
    return this.accountRepo.findOne({
      where: { id, tenantId: this.tenantService.getTenantId() },
      relations: ['socialAccount'],
    });
  }

  async createUploadSession(data: CreateUploadSessionParams): Promise<any> {
    const session = this.entityManager.create('tiktok_upload_sessions', {
      account: { id: data.accountId },
      publishId: data.publishId,
      uploadUrl: data.uploadUrl,
      uploadParams: data.uploadParams,
      status: data.status,
      expiresAt: data.expiresAt,
    });

    return this.entityManager.save('tiktok_upload_sessions', session);
  }

  async getUploadSession(sessionId: string): Promise<any> {
    return this.entityManager.findOne('tiktok_upload_sessions', {
      where: { id: sessionId, tenantId: this.tenantService.getTenantId() },
    });
  }

  async deleteAccount(accountId: string): Promise<void> {
    const account = await this.accountRepo.findOne({
      where: { id: accountId, tenantId: this.tenantService.getTenantId() },
      relations: ['socialAccount'],
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    await this.entityManager.transaction(async (transactionalEntityManager) => {
      // Delete associated videos first
      await transactionalEntityManager.delete(TikTokVideo, {
        account: { id: accountId, tenantId: this.tenantService.getTenantId() },
      });

      // Delete the social account (this will cascade to the TikTok account)
      if (account.socialAccount) {
        await transactionalEntityManager.remove(account.socialAccount);
      }

      // Delete the TikTok account
      await transactionalEntityManager.remove(account);
    });
  }
}
