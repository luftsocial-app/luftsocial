import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  MoreThan,
  LessThan,
  EntityManager,
  DataSource,
} from 'typeorm';
import * as crypto from 'crypto';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';

import { TenantAwareRepository } from '../../../user-management/tenant-aware.repository';
import { AuthState } from '../../entities/facebook-entities/auth-state.entity';
import { FacebookAccount } from '../../entities/facebook-entities/facebook-account.entity';
import { FacebookPageMetric } from '../../entities/facebook-entities/facebook-page-metric.entity';
import { FacebookPage } from '../../entities/facebook-entities/facebook-page.entity';
import { FacebookPostMetric } from '../../entities/facebook-entities/facebook-post-metric.entity';
import { FacebookPost } from '../../entities/facebook-entities/facebook-post.entity';
import { SocialAccount } from '../../../platforms/entities/notifications/entity/social-account.entity';

@Injectable()
export class FacebookRepository extends TenantAwareRepository {
  private readonly logger = new Logger(FacebookRepository.name);

  constructor(
    @InjectRepository(FacebookAccount)
    private readonly accountRepo: Repository<FacebookAccount>,
    @InjectRepository(AuthState)
    private readonly authStateRepo: Repository<AuthState>,
    @InjectRepository(FacebookPage)
    private readonly pageRepo: Repository<FacebookPage>,
    @InjectRepository(FacebookPost)
    private readonly postRepo: Repository<FacebookPost>,
    @InjectRepository(FacebookPostMetric)
    private readonly metricRepo: Repository<FacebookPostMetric>,
    @InjectRepository(FacebookPageMetric)
    private readonly pageMetricRepo: Repository<FacebookPageMetric>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    @InjectRepository(SocialAccount)
    private socialAccountRepo: Repository<SocialAccount>,
    private dataSource: DataSource,
  ) {
    super(accountRepo);
  }

  async createAccount(
    data: Partial<FacebookAccount>,
  ): Promise<FacebookAccount> {
    const socialAccountData = data.socialAccount;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { socialAccount, ...facebookAccountData } = data;

    return this.dataSource.transaction(async (manager) => {
      // First create the social account
      const socialAccount = this.socialAccountRepo.create({
        ...socialAccountData,
        tenantId: data.tenantId, // Ensure tenantId is set
      });

      const savedSocialAccount = await manager.save(socialAccount);

      // Now create the Facebook account with a reference to the social account
      const facebookAccount = this.accountRepo.create({
        ...facebookAccountData,
        socialAccount: savedSocialAccount,
      });

      return await manager.save(facebookAccount);
    });
  }

  async createAuthState(userId: string): Promise<string> {
    const state = crypto.randomBytes(32).toString('hex');

    const authState = this.authStateRepo.create({
      state,
      userId,
      platform: SocialPlatform.FACEBOOK,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    await this.authStateRepo.save(authState);
    return state;
  }

  async updateAccount(
    id: string,
    data: Partial<FacebookAccount>,
  ): Promise<FacebookAccount> {
    await this.accountRepo.update(id, data);
    return this.accountRepo.findOne({
      where: { id, tenantId: this.getTenantId() },
    });
  }

  async createPage(pageData: Partial<FacebookPage>): Promise<FacebookPage> {
    try {
      // Create the page entity
      const page = this.pageRepo.create(pageData);

      // Ensure permissions is set to avoid not-null constraint
      if (
        !page.permissions ||
        !Array.isArray(page.permissions) ||
        page.permissions.length === 0
      ) {
        page.permissions = ['CREATE_CONTENT'];
      }

      return await this.pageRepo.save(page);
    } catch (error) {
      this.logger.error('Error creating page:', error);
      throw error;
    }
  }

  async createPost(data: Partial<FacebookPost>): Promise<FacebookPost> {
    const post = this.postRepo.create(data);
    return this.postRepo.save(post);
  }

  async getAccountById(id: string): Promise<FacebookAccount> {
    return this.accountRepo.findOne({
      where: {
        userId: id,
        tenantId: this.getTenantId(),
      },
      relations: ['socialAccount'],
    });
  }

  async getPageById(
    id: string,
    relations: string[] = [],
  ): Promise<FacebookPage> {
    return this.pageRepo.findOne({
      where: {
        id,
        tenantId: this.getTenantId(),
      },
      relations,
    });
  }

  async getPostById(
    id: string,
    relations: string[] = [],
  ): Promise<FacebookPost> {
    return this.postRepo.findOne({
      where: { id, tenantId: this.getTenantId() },
      relations,
    });
  }
  async getRecentPosts(timeframe: number = 24): Promise<FacebookPost[]> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - timeframe);

    return this.postRepo.find({
      where: {
        createdAt: MoreThan(cutoffTime),
        isPublished: true,
        tenantId: this.getTenantId(),
      },
      relations: ['account'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async getAccountPages(accountId: string): Promise<FacebookPage[]> {
    return this.pageRepo.find({
      where: {
        facebookAccount: { id: accountId },
        tenantId: this.getTenantId(),
      },
      relations: ['facebookAccount'],
    });
  }

  async updateAccountTokens(
    accountId: string,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresAt: Date;
    },
  ): Promise<FacebookAccount> {
    const account = await this.accountRepo.findOne({
      where: {
        id: accountId,
        tenantId: this.getTenantId(),
      },
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

    return this.getAccountById(account.userId);
  }

  async getPagePosts(
    pageId: string,
    limit: number = 10,
  ): Promise<FacebookPost[]> {
    return this.postRepo.find({
      where: { page: { id: pageId }, tenantId: this.getTenantId() },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['metrics'],
    });
  }
  // Unused
  async getRecentPostCount(
    pageId: string,
    timeframe: 'hour' | 'day',
  ): Promise<number> {
    const timeAgo = new Date();
    if (timeframe === 'hour') {
      timeAgo.setHours(timeAgo.getHours() - 1);
    } else {
      timeAgo.setDate(timeAgo.getDate() - 1);
    }

    return this.postRepo.count({
      where: {
        page: { id: pageId },
        tenantId: this.getTenantId(),
        createdAt: MoreThan(timeAgo),
      },
    });
  }

  // Update page token
  async updatePageToken(
    pageId: string,
    newToken: string,
  ): Promise<FacebookPage> {
    await this.pageRepo.update(pageId, {
      accessToken: newToken,
      updatedAt: new Date(),
    });

    return this.pageRepo.findOne({
      where: { id: pageId, tenantId: this.getTenantId() },
    });
  }

  // Update page metrics
  async updatePageMetrics(pageId: string, metrics: any): Promise<FacebookPage> {
    const page = await this.pageRepo.findOne({
      where: { id: pageId, tenantId: this.getTenantId() },
    });

    if (!page) {
      throw new Error('Page not found');
    }

    page.followerCount = metrics.followers;
    const updatedPage = await this.pageRepo.save(page);

    // Create metrics snapshot
    await this.pageMetricRepo.save({
      page: { id: pageId },
      followerCount: metrics.followers,
      fanCount: metrics.fans,
      engagement: metrics.engagement,
      impressions: metrics.impressions,
      reach: metrics.reach,
      demographics: metrics.demographics,
      collectedAt: new Date(),
    });

    return updatedPage;
  }

  // Upsert metrics with atomic transaction
  async upsertPostMetrics(data: {
    postId: string;
    metrics: Partial<FacebookPostMetric>;
  }): Promise<FacebookPostMetric> {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const existing = await transactionalEntityManager.findOne(
          FacebookPostMetric,
          {
            where: {
              post: { id: data.postId },
              tenantId: this.getTenantId(),
              collectedAt: data.metrics.collectedAt,
            },
          },
        );

        if (existing) {
          await transactionalEntityManager.update(
            FacebookPostMetric,
            existing.id,
            {
              ...data.metrics,
              updatedAt: new Date(),
            },
          );

          return transactionalEntityManager.findOne(FacebookPostMetric, {
            where: { id: existing.id, tenantId: this.getTenantId() },
          });
        }

        const newMetric = transactionalEntityManager.create(
          FacebookPostMetric,
          {
            post: { id: data.postId },
            ...data.metrics,
          },
        );

        return transactionalEntityManager.save(newMetric);
      },
    );
  }

  async updatePost(
    postId: string,
    updateData: Partial<FacebookPost>,
  ): Promise<FacebookPost> {
    await this.postRepo.update(postId, updateData);
    return this.postRepo.findOne({
      where: { id: postId, tenantId: this.getTenantId() },
      relations: ['page'],
    });
  }

  async updatePage(
    pageId: string,
    updateData: Partial<FacebookPage>,
  ): Promise<FacebookPage> {
    try {
      const page = await this.pageRepo.findOne({
        where: { id: pageId, tenantId: this.getTenantId() },
      });
      if (!page) {
        throw new NotFoundException(`Page with ID ${pageId} not found`);
      }

      // Update the page properties
      Object.assign(page, updateData);

      // Ensure permissions is set
      if (
        !page.permissions ||
        !Array.isArray(page.permissions) ||
        page.permissions.length === 0
      ) {
        page.permissions = ['CREATE_CONTENT'];
      }

      const updatedPage = await this.pageRepo.save(page);
      this.logger.log(`Page ${pageId} updated successfully`);

      return updatedPage;
    } catch (error) {
      this.logger.error(`Error updating page ${pageId}:`, error);
      throw error;
    }
  }

  // Get accounts with expiring tokens
  async getAccountsWithExpiringTokens(): Promise<FacebookAccount[]> {
    const expirationThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return this.accountRepo.find({
      where: {
        socialAccount: {
          platform: SocialPlatform.FACEBOOK,
          tokenExpiresAt: LessThan(expirationThreshold),
        },
      },
      relations: ['facebookAccount'],
    });
  }

  // Get active pages with metrics
  async getActivePages(): Promise<FacebookPage[]> {
    return this.pageRepo.find({
      relations: ['facebookAccount', 'posts', 'posts.metrics'],
      where: {
        facebookAccount: {
          socialAccount: {
            platform: SocialPlatform.FACEBOOK,
            tokenExpiresAt: MoreThan(new Date()),
          },
        },
      },
    });
  }

  async upsertPageMetrics(data: {
    pageId: string;
    impressions: number;
    engagedUsers: number;
    newFans: number;
    pageViews: number;
    engagements: number;
    followers: number;
    collectedAt: Date;
  }): Promise<FacebookPageMetric> {
    const existingMetric = await this.pageMetricRepo.findOne({
      where: {
        page: { id: data.pageId },
        tenantId: this.getTenantId(),
        collectedAt: data.collectedAt,
      },
    });

    if (existingMetric) {
      await this.pageMetricRepo.update(existingMetric.id, data);
      return this.pageMetricRepo.findOne({ where: { id: existingMetric.id } });
    }

    const newMetric = this.pageMetricRepo.create({
      page: { id: data.pageId },
      ...data,
    });

    return this.pageMetricRepo.save(newMetric);
  }

  async deletePost(postId: string): Promise<void> {
    const post = await this.postRepo.findOne({
      where: { id: postId, tenantId: this.getTenantId() },
      relations: ['metrics'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    await this.entityManager.transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.remove(post.metrics);
      await transactionalEntityManager.remove(post);
    });
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
      // Delete associated pages first
      await transactionalEntityManager.delete(FacebookPage, {
        account: { id: accountId },
      });

      // Delete associated posts first
      await transactionalEntityManager.delete(FacebookPost, {
        account: { id: accountId },
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
