import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan, EntityManager } from 'typeorm';
import * as crypto from 'crypto';
import { InstagramAccount } from '../entities/instagram-account.entity';
import { InstagramMetric } from '../entities/instagram-metric.entity';
import { InstagramRateLimit } from '../entities/instagram-rate-limit.entity';
import { InstagramPost } from '../entities/instagram-post.entity';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import { SocialAccount } from '../../entity/social-account.entity';
import { AuthState } from '../../facebook/entity/auth-state.entity';
import { TenantAwareRepository } from '../../../database/tenant-aware.repository';

@Injectable()
export class InstagramRepository extends TenantAwareRepository {
  constructor(
    @InjectRepository(InstagramAccount)
    private readonly accountRepo: Repository<InstagramAccount>,
    @InjectRepository(InstagramPost)
    private readonly mediaRepo: Repository<InstagramPost>,
    @InjectRepository(InstagramMetric)
    private readonly metricRepo: Repository<InstagramMetric>,
    @InjectRepository(AuthState)
    private readonly authStateRepo: Repository<AuthState>,
    @InjectRepository(InstagramRateLimit)
    private readonly rateLimitRepo: Repository<InstagramRateLimit>,
    @InjectRepository(SocialAccount)
    private readonly socialAccountRepo: Repository<SocialAccount>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {
    super(accountRepo);
  }

  async createPost(data: Partial<InstagramPost>): Promise<InstagramPost> {
    const post = this.mediaRepo.create(data);
    return this.mediaRepo.save(post);
  }

  async getAccountByUserId(userId: string): Promise<InstagramAccount> {
    return this.accountRepo.findOne({
      where: { instagramAccountId: userId, tenantId: this.getTenantId() },
      relations: ['socialAccount'],
    });
  }

  async getMediaInsights(
    mediaId: string,
    timeframe: string,
  ): Promise<InstagramMetric[]> {
    const timeAgo = new Date();
    timeAgo.setDate(timeAgo.getDate() - parseInt(timeframe));

    return this.metricRepo.find({
      where: {
        media: { id: mediaId },
        collectedAt: MoreThan(timeAgo),
        tenantId: this.getTenantId(),
      },
      order: { collectedAt: 'DESC' },
    });
  }

  async createAuthState(userId: string): Promise<string> {
    const state = crypto.randomBytes(32).toString('hex');

    const authState = this.authStateRepo.create({
      state,
      userId,
      platform: SocialPlatform.INSTAGRAM,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    await this.authStateRepo.save(authState);
    return state;
  }

  async getTopPerformingMedia(
    accountId: string,
    limit: number = 10,
  ): Promise<InstagramPost[]> {
    return this.mediaRepo
      .createQueryBuilder('media')
      .leftJoinAndSelect('media.metrics', 'metrics')
      .where('media.account.id = :accountId', { accountId })
      .orderBy('metrics.engagementRate', 'DESC')
      .take(limit)
      .getMany();
  }

  async getActiveAccounts(): Promise<InstagramAccount[]> {
    return this.accountRepo.find({
      where: {
        tenantId: this.getTenantId(),
        socialAccount: {
          tokenExpiresAt: MoreThan(new Date()),
        },
      },
      relations: ['socialAccount'],
    });
  }

  async getRecentMedia(
    accountId: string,
    days: number = 30,
  ): Promise<InstagramPost[]> {
    const timeAgo = new Date();
    timeAgo.setDate(timeAgo.getDate() - days);

    return this.mediaRepo.find({
      where: {
        tenantId: this.getTenantId(),
        account: { id: accountId },
        postedAt: MoreThan(timeAgo),
      },
      relations: ['metrics'],
      order: { postedAt: 'DESC' },
    });
  }

  async upsertMediaMetrics(
    mediaId: string,
    metrics: Partial<InstagramMetric>,
  ): Promise<InstagramMetric> {
    const existingMetric = await this.metricRepo.findOne({
      where: {
        media: { id: mediaId },
        tenantId: this.getTenantId(),
        collectedAt: metrics.collectedAt,
      },
    });

    if (existingMetric) {
      await this.metricRepo.update(existingMetric.id, {
        ...metrics,
        updatedAt: new Date(),
      });
      return this.metricRepo.findOne({ where: { id: existingMetric.id } });
    }

    const newMetric = this.metricRepo.create({
      media: { id: mediaId },
      ...metrics,
    });

    return this.metricRepo.save(newMetric);
  }

  async updateAccountMetrics(
    accountId: string,
    metrics: any,
  ): Promise<InstagramAccount> {
    await this.accountRepo.update(accountId, {
      followerCount: metrics.followers,
      followingCount: metrics.following,
      mediaCount: metrics.mediaCount,
      updatedAt: new Date(),
    });

    return this.accountRepo.findOne({
      where: { id: accountId, tenantId: this.getTenantId() },
      relations: ['socialAccount'],
    });
  }

  async getAccountsWithExpiringTokens(): Promise<InstagramAccount[]> {
    const expirationThreshold = new Date();
    expirationThreshold.setHours(expirationThreshold.getHours() + 24);

    return this.accountRepo.find({
      where: {
        tenantId: this.getTenantId(),
        socialAccount: {
          tokenExpiresAt: LessThan(expirationThreshold),
        },
      },
      relations: ['socialAccount'],
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
      MEDIA_UPLOAD: 25,
      COMMENTS: 60,
      LIKES: 60,
    };

    return count < limits[action];
  }

  async recordRateLimitUsage(accountId: string, action: string): Promise<void> {
    const rateLimit = this.rateLimitRepo.create({
      account: { id: accountId },
      action,
    });

    await this.rateLimitRepo.save(rateLimit);
  }
  async updateAccountTokens(
    accountId: string,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresAt: Date;
    },
  ): Promise<InstagramAccount> {
    const account = await this.accountRepo.findOne({
      where: { id: accountId, tenantId: this.getTenantId() },
      relations: ['socialAccount'],
    });

    if (!account?.socialAccount) {
      throw new NotFoundException('Account not found');
    }

    // Update the social account token information
    await this.entityManager.update(SocialAccount, account.socialAccount.id, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      updatedAt: new Date(),
    });

    return this.getAccountByUserId(accountId);
  }

  async deleteAccount(accountId: string): Promise<void> {
    const account = await this.accountRepo.findOne({
      where: { id: accountId, tenantId: this.getTenantId() },
      relations: ['socialAccount'],
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    await this.entityManager.transaction(async (transactionalEntityManager) => {
      // Delete associated videos first
      await transactionalEntityManager.delete(InstagramPost, {
        account: { id: accountId },
      });

      // Delete the social account (this will cascade to the TikTok account)
      if (account.socialAccount) {
        await transactionalEntityManager.remove(account.socialAccount);
      }
      await transactionalEntityManager.remove(account);
    });
  }
}
