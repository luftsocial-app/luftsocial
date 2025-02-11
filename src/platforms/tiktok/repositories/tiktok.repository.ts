import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, LessThan, MoreThan, Repository } from 'typeorm';
import { TikTokAccount } from '../entities/tiktok-account.entity';
import { TikTokVideo } from '../entities/tiktok-video.entity';
import { TikTokMetric } from '../entities/tiktok-metric.entity';
import { TikTokRateLimit } from '../entities/tiktok_rate_limits.entity';

@Injectable()
export class TikTokRepository {
  constructor(
    @InjectRepository(TikTokAccount)
    private readonly accountRepo: Repository<TikTokAccount>,
    @InjectRepository(TikTokVideo)
    private readonly videoRepo: Repository<TikTokVideo>,
    @InjectRepository(TikTokMetric)
    private readonly metricRepo: Repository<TikTokMetric>,
    @InjectRepository(TikTokRateLimit)
    private readonly rateLimitRepo: Repository<TikTokRateLimit>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  async createAccount(data: Partial<TikTokAccount>): Promise<TikTokAccount> {
    const account = this.accountRepo.create(data);
    return this.accountRepo.save(account);
  }

  async createVideo(data: Partial<TikTokVideo>): Promise<TikTokVideo> {
    const video = this.videoRepo.create(data);
    return this.videoRepo.save(video);
  }

  async updateMetrics(
    videoId: string,
    data: Partial<TikTokMetric>,
  ): Promise<TikTokMetric> {
    const existing = await this.metricRepo.findOne({
      where: {
        video: { id: videoId },
        collectedAt: data.collectedAt,
      },
    });

    if (existing) {
      await this.metricRepo.update(existing.id, data);
      return this.metricRepo.findOne({ where: { id: existing.id } });
    }

    const metric = this.metricRepo.create({ ...data, video: { id: videoId } });
    return this.metricRepo.save(metric);
  }

  async getAccountById(
    id: string,
    relations: string[] = [],
  ): Promise<TikTokAccount> {
    return this.accountRepo.findOne({
      where: { id },
      relations,
    });
  }

  async getRecentVideos(
    accountId: string,
    limit: number = 10,
  ): Promise<TikTokVideo[]> {
    return this.videoRepo.find({
      where: { account: { id: accountId } },
      order: { postedAt: 'DESC' },
      take: limit,
      relations: ['metrics'],
    });
  }

  async getActiveAccounts(): Promise<TikTokAccount[]> {
    return this.accountRepo.find({
      where: {
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
      where: { id },
      relations: ['socialAccount'],
    });
  }

  async createUploadSession(data: {
    accountId: string;
    uploadUrl: string;
    uploadParams: any;
    expiresAt: Date;
  }): Promise<any> {
    const session = this.entityManager.create('tiktok_upload_sessions', {
      account: { id: data.accountId },
      uploadUrl: data.uploadUrl,
      uploadParams: data.uploadParams,
      status: 'PENDING',
      expiresAt: data.expiresAt,
    });

    return this.entityManager.save('tiktok_upload_sessions', session);
  }

  async getUploadSession(sessionId: string): Promise<any> {
    return this.entityManager.findOne('tiktok_upload_sessions', {
      where: { id: sessionId },
    });
  }
}
