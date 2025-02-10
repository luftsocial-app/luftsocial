import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan, EntityManager } from 'typeorm';
import * as crypto from 'crypto';
import { InstagramAccount } from '../entities/instagram-account.entity';
import { InstagramMedia } from '../entities/instagram-media.entity';
import { InstagramMetric } from '../entities/instagram-metric.entity';
import { SocialPlatform } from 'src/enum/social-platform.enum';
import { AuthState } from 'src/platforms/facebook/entity/auth-state.entity';
import { InstagramRateLimit } from '../entities/instagram-rate-limit.entity';
import { SocialAccount } from 'src/platforms/entity/social-account.entity';

@Injectable()
export class InstagramRepository {
  constructor(
    @InjectRepository(InstagramAccount)
    private readonly accountRepo: Repository<InstagramAccount>,
    @InjectRepository(InstagramMedia)
    private readonly mediaRepo: Repository<InstagramMedia>,
    @InjectRepository(InstagramMetric)
    private readonly metricRepo: Repository<InstagramMetric>,
    @InjectRepository(AuthState)
    private readonly authStateRepo: Repository<AuthState>,
    @InjectRepository(InstagramRateLimit)
    private readonly rateLimitRepo: Repository<InstagramRateLimit>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  async getAccountByUserId(userId: string): Promise<InstagramAccount> {
    return this.accountRepo.findOne({
      where: { instagramAccountId: userId },
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
  ): Promise<InstagramMedia[]> {
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
  ): Promise<InstagramMedia[]> {
    const timeAgo = new Date();
    timeAgo.setDate(timeAgo.getDate() - days);

    return this.mediaRepo.find({
      where: {
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
      where: { id: accountId },
      relations: ['socialAccount'],
    });
  }

  async getAccountsWithExpiringTokens(): Promise<InstagramAccount[]> {
    const expirationThreshold = new Date();
    expirationThreshold.setHours(expirationThreshold.getHours() + 24);

    return this.accountRepo.find({
      where: {
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

  async updateToken(
    accountId: string,
    tokenData: {
      accessToken: string;
      expiresIn: number;
    },
  ): Promise<InstagramAccount> {
    const account = await this.accountRepo.findOne({
      where: { id: accountId },
      relations: ['socialAccount'],
    });

    if (!account?.socialAccount) {
      throw new NotFoundException('Account not found');
    }

    // Update the social account token information
    await this.entityManager.update(SocialAccount, account.socialAccount.id, {
      accessToken: tokenData.accessToken,
      tokenExpiresAt: new Date(Date.now() + tokenData.expiresIn * 1000),
      updatedAt: new Date(),
    });

    return this.accountRepo.findOne({
      where: { id: accountId },
      relations: ['socialAccount'],
    });
  }
}
