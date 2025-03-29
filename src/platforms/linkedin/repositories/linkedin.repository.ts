import * as crypto from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, LessThan, MoreThan, Repository } from 'typeorm';
import { LinkedInAccount } from '../../../entities/socials/linkedin-entities/linkedin-account.entity';
import { LinkedInOrganization } from '../../../entities/socials/linkedin-entities/linkedin-organization.entity';
import { LinkedInMetric } from '../../../entities/socials/linkedin-entities/linkedin-metric.entity';
import { LinkedInPost } from '../../../entities/socials/linkedin-entities/linkedin-post.entity';
import { TenantAwareRepository } from '../../../user-management/tenant/tenant-aware.repository';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import { SocialAccount } from '../../../entities/notifications/entity/social-account.entity';
import { AuthState } from '../../../entities/socials/facebook-entities/auth-state.entity';

@Injectable()
export class LinkedInRepository extends TenantAwareRepository {
  constructor(
    @InjectRepository(LinkedInAccount)
    private readonly accountRepo: Repository<LinkedInAccount>,
    @InjectRepository(LinkedInOrganization)
    private readonly orgRepo: Repository<LinkedInOrganization>,
    @InjectRepository(LinkedInPost)
    private readonly postRepo: Repository<LinkedInPost>,
    @InjectRepository(AuthState)
    private readonly authStateRepo: Repository<AuthState>,
    @InjectRepository(LinkedInMetric)
    private readonly metricRepo: Repository<LinkedInMetric>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {
    super(accountRepo);
  }

  async createPost(data: Partial<LinkedInPost>): Promise<LinkedInPost> {
    const post = this.postRepo.create(data);
    return this.postRepo.save(post);
  }

  async createAuthState(userId: string): Promise<string> {
    const state = crypto.randomBytes(32).toString('hex');

    const authState = await this.entityManager.save('auth_states', {
      state,
      userId,
      platform: SocialPlatform.LINKEDIN,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });
    await this.authStateRepo.save(authState);

    return state;
  }

  async getById(id: string): Promise<LinkedInAccount> {
    return this.accountRepo.findOne({
      where: { id, tenantId: this.getTenantId() },
      relations: [
        'socialAccount',
        'organizations',
        'organizations.posts',
        'organizations.posts.metrics',
      ],
    });
  }

  async getOrganizationMetrics(orgId: string, timeframe: string): Promise<any> {
    const timeAgo = new Date();
    timeAgo.setDate(timeAgo.getDate() - parseInt(timeframe));

    const metrics = await this.metricRepo
      .createQueryBuilder('metric')
      .leftJoin('metric.post', 'post')
      .where('post.organization.id = :orgId', { orgId })
      .andWhere('metric.collectedAt > :timeAgo', { timeAgo })
      .getMany();

    return this.aggregateMetrics(metrics);
  }

  private aggregateMetrics(metrics: LinkedInMetric[]): any {
    if (!metrics || !metrics.length) {
      return {
        totalImpressions: 0,
        totalEngagements: 0, // Will be calculated from likes + comments + shares
        avgEngagementRate: 0,
        industries: {},
      };
    }

    const aggregated = metrics.reduce(
      (acc, metric) => {
        // Calculate engagements as sum of likes, comments, and shares
        const engagements = metric.likes + metric.comments + metric.shares;

        const industries = metric.industryData || {};

        return {
          totalImpressions: acc.totalImpressions + metric.impressions,
          totalEngagements: acc.totalEngagements + engagements,
          totalEngagementRate: acc.totalEngagementRate + metric.engagementRate,
          industries: {
            ...acc.industries,
            ...industries,
          },
        };
      },
      {
        totalImpressions: 0,
        totalEngagements: 0,
        totalEngagementRate: 0,
        industries: {},
      },
    );

    // Calculate average engagement rate
    return {
      totalImpressions: aggregated.totalImpressions,
      totalEngagements: aggregated.totalEngagements,
      avgEngagementRate: aggregated.totalEngagementRate / metrics.length,
      industries: aggregated.industries,
    };
  }
  async getAccountsNearingExpiration(): Promise<LinkedInAccount[]> {
    const expirationThreshold = new Date();
    expirationThreshold.setHours(expirationThreshold.getHours() + 24); // 24 hours from now

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

  async updateAccountTokens(
    accountId: string,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresAt: Date;
    },
  ): Promise<LinkedInAccount> {
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

    return this.getById(accountId);
  }

  async getRecentPosts(
    organizationId: string,
    days: number = 30,
  ): Promise<LinkedInPost[]> {
    const timeAgo = new Date();
    timeAgo.setDate(timeAgo.getDate() - days);

    return this.postRepo.find({
      where: {
        tenantId: this.getTenantId(),
        organization: { id: organizationId },
        publishedAt: MoreThan(timeAgo),
      },
      relations: ['metrics'],
      order: { publishedAt: 'DESC' },
    });
  }

  async upsertMetrics(
    postId: string,
    metrics: Partial<LinkedInMetric>,
  ): Promise<LinkedInMetric> {
    const existingMetric = await this.metricRepo.findOne({
      where: {
        tenantId: this.getTenantId(),
        post: { id: postId },
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
      post: { id: postId },
      ...metrics,
    });

    return this.metricRepo.save(newMetric);
  }

  async getActiveOrganizations(): Promise<LinkedInOrganization[]> {
    return this.orgRepo.find({
      where: {
        account: {
          tenantId: this.getTenantId(),
          socialAccount: {
            tokenExpiresAt: MoreThan(new Date()),
          },
        },
      },
      relations: ['account', 'account.socialAccount'],
    });
  }

  async upsertOrganization(data: {
    account: LinkedInAccount;
    organizationId: string;
    name: string;
    vanityName?: string;
    description?: string;
  }): Promise<LinkedInOrganization> {
    const existing = await this.orgRepo.findOne({
      where: {
        tenantId: this.getTenantId(),
        account: { id: data.account.id },
        organizationId: data.organizationId,
      },
    });

    if (existing) {
      await this.orgRepo.update(existing.id, {
        name: data.name,
        vanityName: data.vanityName,
        description: data.description,
        updatedAt: new Date(),
      });
      return this.orgRepo.findOne({ where: { id: existing.id } });
    }

    const newOrg = this.orgRepo.create(data);
    return this.orgRepo.save(newOrg);
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
      // Delete associated posts first
      await transactionalEntityManager.delete(LinkedInPost, {
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
