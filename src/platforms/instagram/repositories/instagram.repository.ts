import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan, EntityManager } from 'typeorm';
import * as crypto from 'crypto';

import { SocialPlatform } from '../../../common/enums/social-platform.enum';

import { AuthState } from '../../entities/facebook-entities/auth-state.entity';
import { InstagramMetric } from '../../entities/instagram-entities/instagram-metric.entity';
import { InstagramPost } from '../../entities/instagram-entities/instagram-post.entity';
import { InstagramRateLimit } from '../../entities/instagram-entities/instagram-rate-limit.entity';
import { InstagramAccount } from '../../entities/instagram-entities/instagram-account.entity';
import { SocialAccount } from '../../../platforms/entities/notifications/entity/social-account.entity';
import { TenantService } from '../../../user-management/tenant.service';

@Injectable()
export class InstagramRepository {
  private readonly logger = new Logger(InstagramRepository.name);

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
    private readonly tenantService: TenantService,
  ) {}

  async createAccount(accountData: any): Promise<InstagramAccount> {
    try {
      this.logger.debug('Creating Instagram account with data:', {
        userId: accountData.userId,
        instagramId: accountData.instagramId,
        username: accountData.username,
      });

      // First check if an account already exists with this user ID and Instagram ID
      const existingAccount = await this.accountRepo.findOne({
        where: {
          userId: accountData.userId,
          tenantId: accountData.tenantId,
          instagramId: accountData.instagramId,
        },
        relations: ['socialAccount'], // Important: Include the relation
      });

      if (existingAccount) {
        this.logger.debug(
          'Updating existing Instagram account:',
          existingAccount.id,
        );

        existingAccount.socialAccount = {
          ...existingAccount.socialAccount,
          accessToken: accountData.socialAccount.accessToken,
          refreshToken: accountData.socialAccount.refreshToken,
          tokenExpiresAt: accountData.socialAccount.expiresAt,
        };

        // Update the account properties
        existingAccount.permissions = accountData.permissions;

        // Make sure metadata has the required structure
        if (
          !existingAccount.metadata ||
          !existingAccount.metadata.instagramAccounts
        ) {
          existingAccount.metadata = {
            instagramAccounts: [
              {
                id: accountData.instagramId || '',
              },
            ],
          };
        }

        // Update other fields
        if (accountData.isBusinessLogin !== undefined) {
          existingAccount.isBusinessLogin = accountData.isBusinessLogin;
        }

        if (accountData.username) {
          existingAccount.username = accountData.username;
        }

        if (accountData.name) {
          existingAccount.name = accountData.name;
        }

        if (accountData.profilePictureUrl) {
          existingAccount.profilePictureUrl = accountData.profilePictureUrl;
        }

        if (accountData.biography) {
          existingAccount.biography = accountData.biography;
        }

        if (accountData.facebookPageId) {
          existingAccount.facebookPageId = accountData.facebookPageId;
        }

        if (accountData.facebookPageName) {
          existingAccount.facebookPageName = accountData.facebookPageName;
        }

        if (accountData.facebookPageAccessToken) {
          existingAccount.facebookPageAccessToken =
            accountData.facebookPageAccessToken;
        }

        return await this.accountRepo.save(existingAccount);
      }

      // Ensure metadata has the required structure
      if (!accountData.metadata || !accountData.metadata.instagramAccounts) {
        accountData.metadata = {
          instagramAccounts: [
            {
              id: accountData.instagramId || '',
            },
          ],
        };
      }

      // Create a new Instagram account
      const newAccount = this.accountRepo.create({
        userId: accountData.userId,
        tenantId: accountData.tenantId,
        permissions: accountData.permissions,
        socialAccount: accountData.socialAccount,
        instagramId: accountData.instagramId,
        username: accountData.username,
        name: accountData.name || accountData.username,
        profilePictureUrl: accountData.profilePictureUrl,
        biography: accountData.biography,
        facebookPageId: accountData.facebookPageId,
        facebookPageName: accountData.facebookPageName,
        facebookPageAccessToken: accountData.facebookPageAccessToken,
        accountType: accountData.accountType || 'business',
        isBusinessLogin: accountData.isBusinessLogin || false,
        metadata: accountData.metadata, // Make sure this is always set with the required structure
      });

      this.logger.debug(
        'Created new Instagram account entity with metadata:',
        JSON.stringify(newAccount.metadata),
      );

      return await this.accountRepo.save(newAccount);
    } catch (error) {
      this.logger.error('Failed to create Instagram account', error);

      // Enhanced error logging for database errors
      if (error.code) {
        this.logger.error(
          `Database error code: ${error.code}, column: ${error.column}`,
        );
        this.logger.error(`Detailed error: ${error.detail}`);
      }

      throw error;
    }
  }

  async createPost(data: Partial<InstagramPost>): Promise<InstagramPost> {
    const post = this.mediaRepo.create(data);
    return this.mediaRepo.save(post);
  }

  async getAccountByUserId(userId: string): Promise<InstagramAccount> {
    return this.accountRepo.findOne({
      where: {
        userId: userId,
        tenantId: this.tenantService.getTenantId(),
      },
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
        tenantId: this.tenantService.getTenantId(),
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
        tenantId: this.tenantService.getTenantId(),
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
        tenantId: this.tenantService.getTenantId(),
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
        tenantId: this.tenantService.getTenantId(),
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
      where: { id: accountId, tenantId: this.tenantService.getTenantId() },
      relations: ['socialAccount'],
    });
  }

  async getAccountsWithExpiringTokens(): Promise<InstagramAccount[]> {
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

  async getAccountsByPlatform(
    userId: string,
    tenantId: string,
    platform: SocialPlatform,
  ): Promise<InstagramAccount[]> {
    try {
      // For INSTAGRAM_BUSINESS, filter by isBusinessLogin = true
      // For regular INSTAGRAM, filter by isBusinessLogin = false
      const isBusinessLogin = platform === SocialPlatform.INSTAGRAM_BUSINESS;

      // Use query builder to filter by nested property
      return await this.accountRepo
        .createQueryBuilder('account')
        .where('account.userId = :userId', { userId })
        .andWhere('account.tenantId = :tenantId', { tenantId })
        .andWhere('account.isBusinessLogin = :isBusinessLogin', {
          isBusinessLogin,
        })
        // Use JSON operations to check the platform in the socialAccount JSON column
        .andWhere(`account.socialAccount->>'platform' = :platform`, {
          platform: isBusinessLogin
            ? SocialPlatform.INSTAGRAM_BUSINESS
            : SocialPlatform.INSTAGRAM,
        })
        .getMany();
    } catch (error) {
      this.logger.error(
        `Failed to get Instagram accounts by platform: ${platform} for user: ${userId}`,
        error,
      );
      throw error;
    }
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
      where: { id: accountId, tenantId: this.tenantService.getTenantId() },
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
      where: { id: accountId, tenantId: this.tenantService.getTenantId() },
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
