import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import axios from 'axios';
import * as config from 'config';
import { LinkedInRepository } from './repositories/linkedin.repository';
import {
  CommentResponse,
  MediaItem,
  PlatformService,
  PostResponse,
  SocialAccountDetails,
} from '../platform-service.interface';
import { LinkedInApiException } from './helpers/linkedin-api.exception';
import { LinkedInOrganization } from './helpers/linkedin.interface';
import {
  AccountMetrics,
  DateRange,
  PostMetrics,
} from '../../cross-platform/helpers/cross-platform.interface';
import { LinkedInAccount } from '../../entities/socials/linkedin-entities/linkedin-account.entity';
import { TenantService } from '../../database/tenant.service';
import { CreateLinkedInPostDto } from './helpers/create-post.dto';
import { MediaStorageService } from '../../asset-management/media-storage/media-storage.service';
import { MediaStorageItem } from '../../asset-management/media-storage/media-storage.dto';

@Injectable()
export class LinkedInService implements PlatformService {
  private readonly apiVersion: string = 'v2';
  private readonly baseUrl: string = 'https://api.linkedin.com';
  private readonly logger = new Logger(LinkedInService.name);

  constructor(
    private readonly linkedInRepo: LinkedInRepository,
    private readonly tenantService: TenantService,
    private readonly mediaStorageService: MediaStorageService,
  ) { }

  private async uploadLinkedInMediaItemsToStorage(
    media: MediaItem[],
    linkedInAccountId: string,
    context: 'post' | 'scheduled',
  ): Promise<MediaStorageItem[]> {
    const mediaItems: MediaStorageItem[] = [];

    if (!media?.length) {
      return mediaItems;
    }

    for (const mediaItem of media) {
      const timestamp = Date.now();
      const prefix = `linkedin-${context}-${timestamp}`;

      if (mediaItem.file) {
        // For uploaded files
        const uploadedMedia = await this.mediaStorageService.uploadPostMedia(
          linkedInAccountId,
          [mediaItem.file],
          prefix,
        );
        mediaItems.push(...uploadedMedia);
      } else if (mediaItem.url) {
        // For media URLs
        const uploadedMedia = await this.mediaStorageService.uploadMediaFromUrl(
          linkedInAccountId,
          mediaItem.url,
          prefix,
        );
        mediaItems.push(uploadedMedia);
      }
    }

    return mediaItems;
  }

  async getAccountsByUserId(userId: string): Promise<LinkedInAccount> {
    try {
      const tenantId = this.tenantService.getTenantId();
      this.linkedInRepo.setTenantId(tenantId);

      return await this.linkedInRepo.getById(userId);
    } catch (error) {
      this.logger.error(
        `Failed to fetch Facebook accounts for user ${userId}`,
        error.stack,
      );
    }
  }

  async getUserAccounts(userId: string): Promise<SocialAccountDetails[]> {
    const tenantId = this.tenantService.getTenantId();
    this.linkedInRepo.setTenantId(tenantId);

    const account = await this.linkedInRepo.getById(userId);
    if (!account) {
      throw new NotFoundException('No Linkedin accounts found for user');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/organizationAcls`, {
        headers: {
          Authorization: `Bearer ${account.socialAccount.accessToken}`,
        },
        params: {
          q: 'roleAssignee',
        },
      });

      const organizationIds = response.data.elements.map(
        (el) => el.organization,
      );
      const orgDetails = await Promise.all(
        organizationIds.map((orgId) =>
          axios.get(`${this.baseUrl}/organizations/${orgId}`, {
            headers: {
              Authorization: `Bearer ${account.socialAccount.accessToken}`,
            },
          }),
        ),
      );

      return orgDetails.map((org) => ({
        id: org.data.id,
        name: org.data.localizedName,
        type: 'organization',
        avatarUrl: org.data.logoV2?.original,
        platformSpecific: {
          vanityName: org.data.vanityName,
          locations: org.data.locations,
        },
      }));
    } catch (error) {
      throw new LinkedInApiException('Failed to fetch user accounts', error);
    }
  }

  async post(
    accountId: string,
    creatPostDto: CreateLinkedInPostDto,
    media?: MediaItem[],
  ): Promise<PostResponse> {
    try {
      const tenantId = this.tenantService.getTenantId();
      this.linkedInRepo.setTenantId(tenantId);

      const account = await this.linkedInRepo.getById(accountId);
      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      const author = `urn:li:organization:${account.metadata.organizations[0].id}`;

      const postData: any = {
        author,
        commentary: creatPostDto.content,
        visibility: creatPostDto.visibility,
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
      };

      // Store media in S3 first if there are any media items
      const mediaItems = await this.uploadLinkedInMediaItemsToStorage(
        media,
        account.linkedinUserId,
        'post',
      );

      // Handle media if provided
      if (mediaItems?.length) {
        const mediaAssets = await Promise.all(
          mediaItems.map((mediaItem) =>
            this.uploadMedia(account.socialAccount.accessToken, mediaItem.url),
          ),
        );

        postData.content = {
          media: {
            id: mediaAssets[0].asset,
            type: mediaAssets[0].type,
          },
        };
      }

      const response = await axios.post(
        `${this.baseUrl}/rest/posts`,
        postData,
        {
          headers: {
            Authorization: `Bearer ${account.socialAccount.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': this.apiVersion,
          },
        },
      );

      await this.linkedInRepo.createPost({
        postId: response.data.id,
        content: creatPostDto.content,
        mediaItems,
        isPublished: true,
        publishedAt: new Date(),
      });

      return {
        platformPostId: response.data.id,
        postedAt: new Date(),
      };
    } catch (error) {
      throw new LinkedInApiException('Failed to create LinkedIn post', error);
    }
  }

  async getComments(
    accountId: string,
    postId: string,
    pageToken?: string,
  ): Promise<CommentResponse> {
    try {
      const tenantId = this.tenantService.getTenantId();
      this.linkedInRepo.setTenantId(tenantId);

      const account = await this.linkedInRepo.getById(accountId);
      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      const response = await axios.get(
        `${this.baseUrl}/rest/socialActions/${postId}/comments`,
        {
          headers: {
            Authorization: `Bearer ${account.socialAccount.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': this.apiVersion,
          },
          params: {
            start: pageToken || 0,
            count: 20,
          },
        },
      );

      return {
        items: response.data.elements.map((comment) => ({
          id: comment.id,
          content: comment.message.text,
          authorId: comment.actor,
          authorName: comment.actor.name,
          createdAt: new Date(comment.created.time),
        })),
        nextPageToken: response.data.paging?.start?.toString(),
      };
    } catch (error) {
      throw new LinkedInApiException(
        'Failed to fetch LinkedIn comments',
        error,
      );
    }
  }

  async getPostMetrics(
    accountId: string,
    postId: string,
  ): Promise<PostMetrics> {
    try {
      const tenantId = this.tenantService.getTenantId();
      this.linkedInRepo.setTenantId(tenantId);

      const account = await this.linkedInRepo.getById(accountId);
      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      const response = await axios.get(
        `${this.baseUrl}/rest/organizationalEntityShareStatistics`,
        {
          headers: {
            Authorization: `Bearer ${account.socialAccount.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': this.apiVersion,
          },
          params: {
            q: 'organizationalEntity',
            organizationalEntity: postId,
          },
        },
      );

      const stats = response.data.totalShareStatistics;

      return {
        engagement: stats.engagement || 0,
        impressions: stats.impressionCount || 0,
        reach: stats.uniqueImpressionsCount || 0,
        reactions: stats.likeCount || 0,
        comments: stats.commentCount || 0,
        shares: stats.shareCount || 0,
        platformSpecific: {
          clicks: stats.clickCount || 0,
          engagement_detail: {
            likes: stats.likeCount || 0,
            comments: stats.commentCount || 0,
            shares: stats.shareCount || 0,
            clicks: stats.clickCount || 0,
          },
        },
      };
    } catch (error) {
      throw new LinkedInApiException('Failed to fetch LinkedIn metrics', error);
    }
  }

  async getAccountMetrics(
    accountId: string,
    dateRange: DateRange,
  ): Promise<AccountMetrics> {
    const tenantId = this.tenantService.getTenantId();
    this.linkedInRepo.setTenantId(tenantId);

    const account = await this.linkedInRepo.getById(accountId);
    if (!account) throw new NotFoundException('Account not found');
    if (!account.organizations || account.organizations.length === 0) {
      throw new LinkedInApiException('No organizations found for account');
    }

    try {
      // Fetch metrics for all organizations and aggregate them
      const metrics = await Promise.all(
        account.organizations.map(async (orgId) => {
          const response = await axios.get(
            `${this.baseUrl}/organizationalEntityShareStatistics`,
            {
              params: {
                q: 'organizationalEntity',
                organizationalEntity: orgId,
                timeIntervals: {
                  start: dateRange.startDate,
                  end: dateRange.endDate,
                },
              },
              headers: {
                Authorization: `Bearer ${account.socialAccount.accessToken}`,
              },
            },
          );

          return {
            followers: response.data.followerCount || 0,
            engagement: response.data.engagement || 0,
            impressions: response.data.impressionCount || 0,
            reach: response.data.uniqueImpressionsCount || 0,
            posts: response.data.shareCount || 0,
            platformSpecific: {
              organizationId: orgId,
              clickCount: response.data.clickCount,
              likeCount: response.data.likeCount,
              commentCount: response.data.commentCount,
              shareCount: response.data.shareCount,
            },
          };
        }),
      );

      // Aggregate metrics from all organizations
      const aggregatedMetrics = metrics.reduce(
        (acc, curr) => ({
          followers: acc.followers + curr.followers,
          engagement: acc.engagement + curr.engagement,
          impressions: acc.impressions + curr.impressions,
          reach: acc.reach + curr.reach,
          posts: acc.posts + curr.posts,
          platformSpecific: {
            organizations: [
              ...(acc.platformSpecific?.organizations || []),
              curr.platformSpecific,
            ],
          },
        }),
        {
          followers: 0,
          engagement: 0,
          impressions: 0,
          reach: 0,
          posts: 0,
          platformSpecific: { organizations: [] },
        },
      );

      return {
        ...aggregatedMetrics,
        dateRange,
      };
    } catch (error) {
      throw new LinkedInApiException('Failed to fetch account metrics', error);
    }
  }

  private async getUserProfile(accessToken: string): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/v2/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  }

  private async getOrganizations(accessToken: string): Promise<any[]> {
    const response = await axios.get(
      `${this.baseUrl}/v2/organizationAcls?q=roleAssignee`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    return response.data.elements;
  }
  private async uploadMedia(
    accessToken: string,
    mediaUrl: string,
  ): Promise<any> {
    // First, initiate upload
    const registerUpload = await axios.post(
      `${this.baseUrl}/rest/assets?action=registerUpload`,
      {
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: 'urn:li:organization:123', // Replace with actual org ID
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            },
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      },
    );

    // Download media
    const mediaResponse = await axios.get(mediaUrl, { responseType: 'stream' });

    // Upload to LinkedIn
    await axios.put(
      registerUpload.data.value.uploadMechanism[
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
      ].uploadUrl,
      mediaResponse.data,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': mediaResponse.headers['content-type'],
        },
      },
    );

    return {
      asset: registerUpload.data.value.asset,
      type: 'IMAGE',
    };
  }

  async getUserOrganizations(
    accountId: string,
  ): Promise<LinkedInOrganization[]> {
    const tenantId = this.tenantService.getTenantId();
    this.linkedInRepo.setTenantId(tenantId);

    const account = await this.linkedInRepo.getById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    try {
      const response = await axios.get(`${this.baseUrl}/organizations`, {
        headers: {
          Authorization: `Bearer ${account.socialAccount.accessToken}`,
        },
        params: {
          q: 'admin',
          fields: 'id,name,vanityName,localizedName,localizedDescription',
        },
      });

      const organizations = await Promise.all(
        response.data.elements.map(async (org: any) => {
          return this.linkedInRepo.upsertOrganization({
            account: account,
            organizationId: org.id,
            name: org.localizedName || org.name,
            vanityName: org.vanityName,
            description: org.localizedDescription,
          });
        }),
      );

      return organizations;
    } catch (error) {
      throw new HttpException(
        'Failed to fetch LinkedIn organizations',
        HttpStatus.BAD_REQUEST,
        error,
      );
    }
  }

  async revokeAccess(accountId: string): Promise<void> {
    const tenantId = this.tenantService.getTenantId();
    this.linkedInRepo.setTenantId(tenantId);

    const account = await this.linkedInRepo.getById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    try {
      await axios.post(
        'https://www.linkedin.com/oauth/v2/revoke',
        new URLSearchParams({
          client_id: config.get('LINKEDIN_CLIENT_ID'),
          client_secret: config.get('LINKEDIN_CLIENT_SECRET'),
          token: account.socialAccount.accessToken,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      await this.linkedInRepo.deleteAccount(accountId);
    } catch (error) {
      throw new LinkedInApiException('Failed to revoke LinkedIn access', error);
    }
  }
}
