import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  InternalServerErrorException, // Added InternalServerErrorException
} from '@nestjs/common';
import axios from 'axios';
import * as config from 'config'; // config package might need to be replaced with @nestjs/config
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
import { LinkedInAccount } from '../entities/linkedin-entities/linkedin-account.entity';
import { CreateLinkedInPostDto } from './helpers/create-post.dto';
import { MediaStorageService } from '../../asset-management/media-storage/media-storage.service';
import { MediaStorageItem } from '../../asset-management/media-storage/media-storage.dto';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class LinkedInService implements PlatformService {
  private readonly apiVersion: string = 'v2';
  private readonly baseUrl: string = 'https://api.linkedin.com';

  constructor(
    private readonly linkedInRepo: LinkedInRepository,
    private readonly mediaStorageService: MediaStorageService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(LinkedInService.name);
  }

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

  async getAccountsByUserId(userId: string): Promise<LinkedInAccount> { // userId is Clerk User ID
    try {
      const account = await this.linkedInRepo.getAccountByClerkUserId(userId);
      if (!account) {
        this.logger.warn(`LinkedIn account not found for Clerk User ID: ${userId}`);
        throw new NotFoundException('LinkedIn account not found for this user.');
      }
      return account;
    } catch (error) {
      this.logger.error(
        `Failed to fetch LinkedIn account for user ${userId}: ${error.message}`, // Corrected log
        error.stack
      );
      if (error instanceof NotFoundException || error instanceof HttpException) { // Re-throw if it's already a known HTTP exception
          throw error;
      }
      // Wrap other errors
      throw new InternalServerErrorException(`Error fetching LinkedIn account: ${error.message}`); 
    }
  }

  async getUserAccounts(userId: string): Promise<SocialAccountDetails[]> {
    // This method should now use getAccountsByUserId which expects a Clerk User ID
    // The original `this.linkedInRepo.getById(userId)` was incorrect if userId was a Clerk ID.
    // Assuming `userId` parameter here is the Clerk User ID.
    const account = await this.getAccountsByUserId(userId); 
    // No need for `if (!account)` here, as getAccountsByUserId will throw NotFoundException

    try {

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
    // Assuming accountId here is the DB ID of the LinkedInAccount, not the Clerk User ID.
    // If it's meant to be Clerk User ID, then this should also use getAccountsByUserId.
    // For now, keeping it as is, assuming it's the specific platform account ID.
    // If this `accountId` is actually the Clerk User ID, then the call should be:
    // const account = await this.getAccountsByUserId(accountId);
    // However, the PlatformAuthService's refreshToken takes platform accountId.
    // Let's assume this `accountId` is the DB ID of the LinkedInAccount.
    // If so, `getById` is correct. If it's Clerk User ID, then it needs to change.
    // The task is about getAccountsByUserId, so leaving this as is unless specified.
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
