import * as crypto from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, LessThan, MoreThan, Repository } from 'typeorm';
import { LinkedInAccount } from '../../entities/linkedin-entities/linkedin-account.entity';
import { LinkedInOrganization } from '../../entities/linkedin-entities/linkedin-organization.entity';
import { LinkedInMetric } from '../../entities/linkedin-entities/linkedin-metric.entity';
import { LinkedInPost } from '../../entities/linkedin-entities/linkedin-post.entity';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import { AuthState } from '../../entities/facebook-entities/auth-state.entity';
import { SocialAccount } from '../../../platforms/entities/notifications/entity/social-account.entity';
import { TenantService } from '../../../user-management/tenant.service';
import { PinoLogger } from 'nestjs-pino'; // Added PinoLogger import

@Injectable()
export class LinkedInRepository {
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
    @InjectRepository(SocialAccount) // Added SocialAccount repository injection
    private readonly socialAccountRepo: Repository<SocialAccount>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly tenantService: TenantService,
    private readonly logger: PinoLogger, // Added PinoLogger injection
  ) {
    this.logger.setContext(LinkedInRepository.name); // Set context for logger
  }

  async getAccountByClerkUserId(clerkUserId: string): Promise<LinkedInAccount | null> {
    const tenantId = this.tenantService.getTenantId();
    this.logger.debug(`Attempting to find LinkedIn account for Clerk User ID: ${clerkUserId} in tenant: ${tenantId}`);
  
    const socialAccount = await this.socialAccountRepo.findOne({
      where: {
        userId: clerkUserId,
        platform: SocialPlatform.LINKEDIN,
        tenantId: tenantId,
      },
    });
  
    if (!socialAccount) {
      this.logger.warn(`No LinkedIn social account found for Clerk User ID: ${clerkUserId} in tenant: ${tenantId}`);
      return null;
    }
  
    const linkedInAccount = await this.accountRepo.findOne({
      where: {
        socialAccount: { id: socialAccount.id },
        tenantId: tenantId,
      },
      relations: ['socialAccount', 'organizations'], // Adjust relations as needed
    });
  
    if (!linkedInAccount) {
      this.logger.error(`Data inconsistency: LinkedIn SocialAccount ${socialAccount.id} found but no corresponding LinkedInAccount for Clerk User ID: ${clerkUserId} in tenant: ${tenantId}`);
      return null;
    }
    
    return linkedInAccount;
  }
  

  async createAccount(data: any): Promise<LinkedInAccount> {
    return this.entityManager.transaction(async (transactionManager) => {
      // 1. Create SocialAccount
      const socialAccountData = data.socialAccount;
      const socialAccountEntity = this.socialAccountRepo.create({ // Use injected socialAccountRepo
        // Spread common SocialAccount fields from socialAccountData
        accessToken: socialAccountData.accessToken,
        refreshToken: socialAccountData.refreshToken,
        tokenExpiresAt: socialAccountData.tokenExpiresAt || socialAccountData.expiresAt, // Handle potential naming difference
        scope: socialAccountData.scope,
        // Specific fields for SocialAccount
        userId: socialAccountData.userId, // This is the Clerk User ID
        platformUserId: socialAccountData.platformUserId, // LinkedIn's ID for the user on the platform
        platform: SocialPlatform.LINKEDIN, // Explicitly set platform
        tenantId: data.tenantId,
        metadata: socialAccountData.metadata, // If metadata is passed for socialAccount
      });
      const savedSocialAccount = await transactionManager.save(SocialAccount, socialAccountEntity); // Use SocialAccount class as first arg

      // 2. Create LinkedInAccount
      const linkedInAccountEntity = this.accountRepo.create({
        tenantId: data.tenantId,
        socialAccount: savedSocialAccount, // Link to the saved SocialAccount
        linkedinUserId: data.linkedinUserId, // This is from userInfo.id (platform-specific LinkedIn user ID)
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email, // Assuming email is passed in data
        profileUrl: data.profileUrl, // Assuming profileUrl is passed in data
        permissions: data.permissions,
        // any other LinkedIn-specific fields from data
      });
      const savedLinkedInAccount = await transactionManager.save(LinkedInAccount, linkedInAccountEntity); // Use LinkedInAccount class as first arg
      
      return savedLinkedInAccount;
    });
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
      where: { id, tenantId: this.tenantService.getTenantId() },
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
        tenantId: this.tenantService.getTenantId(),
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
        tenantId: this.tenantService.getTenantId(),
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
        tenantId: this.tenantService.getTenantId(),
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
          tenantId: this.tenantService.getTenantId(),
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
        tenantId: this.tenantService.getTenantId(),
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
      where: { id: accountId, tenantId: this.tenantService.getTenantId() },
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
