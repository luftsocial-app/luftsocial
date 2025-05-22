import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import * as config from 'config';
import axios from 'axios';
import { InstagramRepository } from './repositories/instagram.repository';
import { InstagramApiException } from './helpers/instagram-api.exception';
import {
  CommentResponse,
  MediaItem,
  PlatformService,
  PostResponse,
  SocialAccountDetails,
} from '../platform-service.interface';
import { AccountInsights } from './helpers/instagram-account.interface';
import {
  CreateInstagramPostDto,
  CreateStoryDto,
} from './helpers/create-content.dto';
import {
  AccountMetrics,
  DateRange,
  PostMetrics,
} from '../../common/interface/platform-metrics.interface';
import { MediaStorageItem } from '../../asset-management/media-storage/media-storage.dto';
import { MediaStorageService } from '../../asset-management/media-storage/media-storage.service';
import { MediaType } from '../../common/enums/media-type.enum';
import { InstagramAccount } from '../entities/instagram-entities/instagram-account.entity';
import { PinoLogger } from 'nestjs-pino';
import { TenantService } from '../../user-management/tenant.service';

@Injectable()
export class InstagramService implements PlatformService {
  // Base URLs for different authentication methods
  private readonly facebookGraphUrl: string =
    'https://graph.facebook.com/v18.0';
  private readonly instagramGraphUrl: string = 'https://graph.instagram.com';

  constructor(
    private readonly instagramRepo: InstagramRepository,
    private readonly mediaStorageService: MediaStorageService,
    private readonly tenantService: TenantService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(InstagramService.name);
  }

  /**
   * Determines the appropriate base URL and access token based on authentication method
   */
  private getApiConfig(account: InstagramAccount): {
    baseUrl: string;
    accessToken: string;
    instagramAccountId: string;
  } {
    if (account.isBusinessLogin) {
      // Direct Instagram Business Login
      return {
        baseUrl: this.instagramGraphUrl,
        accessToken: account.socialAccount.accessToken,
        instagramAccountId: account.instagramId,
      };
    } else {
      // Instagram with Facebook Login - use Page access token
      return {
        baseUrl: this.facebookGraphUrl,
        accessToken:
          account.facebookPageAccessToken || account.socialAccount.accessToken,
        instagramAccountId: account.instagramId,
      };
    }
  }

  private async uploadInstagramMediaItems(
    media: MediaItem[],
    instagramAccountId: string,
    context: 'post' | 'scheduled',
  ): Promise<MediaStorageItem[]> {
    const mediaItems: MediaStorageItem[] = [];

    if (!media?.length) {
      return mediaItems;
    }

    for (const mediaItem of media) {
      const timestamp = Date.now();
      const prefix = `instagram-${context}-${timestamp}`;

      if (mediaItem.file) {
        // For uploaded files
        const uploadedMedia = await this.mediaStorageService.uploadPostMedia(
          instagramAccountId,
          [mediaItem.file],
          prefix,
        );
        mediaItems.push(...uploadedMedia);
      } else if (mediaItem.url) {
        // For media URLs
        const uploadedMedia = await this.mediaStorageService.uploadMediaFromUrl(
          instagramAccountId,
          mediaItem.url,
          prefix,
        );
        mediaItems.push(uploadedMedia);
      }
    }

    return mediaItems;
  }

  async withRateLimit<T>(
    accountId: string,
    action: string,
    callback: () => Promise<T>,
  ): Promise<T> {
    const canProceed = await this.instagramRepo.checkRateLimit(
      accountId,
      action,
    );
    if (!canProceed) {
      throw new HttpException(
        'Rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      const result = await callback();
      await this.instagramRepo.recordRateLimitUsage(accountId, action);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async getAccountsByUserId(userId: string): Promise<InstagramAccount> {
    try {
      return await this.instagramRepo.getAccountByUserId(userId);
    } catch (error) {
      this.logger.error(
        `Failed to fetch Instagram accounts for user ${userId}`,
        error.stack,
      );
      throw error;
    }
  }

  async getUserAccounts(userId: string): Promise<SocialAccountDetails> {
    const account = await this.instagramRepo.getAccountByUserId(userId);

    if (!account) {
      throw new NotFoundException('No Instagram account found for user');
    }

    // Transform accounts to SocialAccountDetails format
    return {
      id: account.id,
      name: account.username || account.name,
      type: account.accountType || 'business',
      avatarUrl: account.profilePictureUrl,
      platformSpecific: {
        accountType: account.accountType,
        isBusinessLogin: account.isBusinessLogin,
        instagramId: account.instagramId,
        facebookPageId: account.facebookPageId,
      },
    };
  }

  /**
   * Enhanced post method that handles both authentication methods and includes
   * caption, hashtags, and mentions
   */
  async post(
    accountId: string,
    content: CreateInstagramPostDto,
    media?: MediaItem[],
  ): Promise<PostResponse> {
    try {
      const account = await this.instagramRepo.getAccountByUserId(accountId);
      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      const { hashtags, mentions, caption } = content;

      // Build the full caption with hashtags and mentions
      let fullCaption = caption || '';

      if (mentions && mentions.length > 0) {
        const mentionText = mentions.map((mention) => `@${mention}`).join(' ');
        fullCaption = `${fullCaption} ${mentionText}`.trim();
      }

      if (hashtags && hashtags.length > 0) {
        const hashtagText = hashtags
          .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
          .join(' ');
        fullCaption = `${fullCaption} ${hashtagText}`.trim();
      }

      // Store media in S3 first if there are any media items
      const mediaItems = await this.uploadInstagramMediaItems(
        media,
        account.userId,
        'post',
      );

      const apiConfig = this.getApiConfig(account);

      if (!mediaItems?.length) {
        throw new HttpException(
          'Instagram requires at least one media item',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 1. Create media containers
      const mediaContainers = await Promise.all(
        mediaItems.map((mediaItem) =>
          this.createMediaContainer(
            apiConfig.instagramAccountId,
            mediaItem.url,
            fullCaption,
            apiConfig.baseUrl,
            apiConfig.accessToken,
          ),
        ),
      );

      // 2. Create post container (for single media) or carousel container (for multiple media)
      let containerId: string;
      if (mediaContainers.length === 1) {
        containerId = mediaContainers[0].id;
      } else {
        containerId = await this.createCarouselContainer(
          apiConfig.instagramAccountId,
          mediaContainers.map((c) => c.id),
          fullCaption,
          apiConfig.baseUrl,
          apiConfig.accessToken,
        );
      }

      // 3. Publish post
      const response = await axios.post(
        `${apiConfig.baseUrl}/${apiConfig.instagramAccountId}/media_publish`,
        null,
        {
          params: {
            creation_id: containerId,
            access_token: apiConfig.accessToken,
          },
        },
      );

      // 4. Save post to database
      await this.instagramRepo.createPost({
        account: account,
        caption: fullCaption,
        mentions: mentions || [],
        hashtags: hashtags || [],
        mediaItems: mediaItems,
        postId: response.data.id,
        isPublished: true,
        postedAt: new Date(),
      });

      return {
        platformPostId: response.data.id,
        postedAt: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to create Instagram post', error);
      throw new InstagramApiException('Failed to create Instagram post', error);
    }
  }

  async getComments(
    accountId: string,
    postId: string,
    pageToken?: string,
  ): Promise<CommentResponse> {
    try {
      const account = await this.instagramRepo.getAccountByUserId(accountId);
      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      const apiConfig = this.getApiConfig(account);

      const response = await axios.get(
        `${apiConfig.baseUrl}/${postId}/comments`,
        {
          params: {
            access_token: apiConfig.accessToken,
            fields: 'id,text,timestamp,username,from',
            after: pageToken,
          },
        },
      );

      return {
        items: response.data.data.map((comment) => ({
          id: comment.id,
          content: comment.text,
          authorId: comment.from?.id || comment.username,
          authorName: comment.from?.username || comment.username,
          createdAt: new Date(comment.timestamp),
        })),
        nextPageToken: response.data.paging?.cursors?.after,
      };
    } catch (error) {
      throw new InstagramApiException(
        'Failed to fetch Instagram comments',
        error,
      );
    }
  }

  async getPostMetrics(
    accountId: string,
    postId: string,
  ): Promise<PostMetrics> {
    try {
      const account = await this.instagramRepo.getAccountByUserId(accountId);
      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      const apiConfig = this.getApiConfig(account);

      // Different metrics available for different authentication methods
      const metricsToFetch = account.isBusinessLogin
        ? 'engagement,impressions,reach'
        : 'engagement,impressions,reach,saved,likes,comments,shares';

      const response = await axios.get(
        `${apiConfig.baseUrl}/${postId}/insights`,
        {
          params: {
            access_token: apiConfig.accessToken,
            metric: metricsToFetch,
            period: 'lifetime',
          },
        },
      );

      const metrics: Record<string, number> = {};
      response.data.data.forEach((metric) => {
        metrics[metric.name] = metric.values[0].value;
      });

      return {
        engagement: metrics.engagement || 0,
        impressions: metrics.impressions || 0,
        reach: metrics.reach || 0,
        reactions: metrics.likes || 0,
        comments: metrics.comments || 0,
        shares: metrics.shares || 0,
        saves: metrics.saved || 0,
        platformSpecific: {
          saved: metrics.saved || 0,
          storyReplies: metrics.story_replies || 0,
          storyTaps: metrics.story_taps_back || 0,
          storyExits: metrics.story_exits || 0,
        },
      };
    } catch (error) {
      throw new InstagramApiException(
        'Failed to fetch Instagram metrics',
        error,
      );
    }
  }

  async getAccountMetrics(
    accountId: string,
    dateRange: DateRange,
  ): Promise<AccountMetrics> {
    const account = await this.instagramRepo.getAccountByUserId(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const apiConfig = this.getApiConfig(account);

    try {
      const metricsToFetch = account.isBusinessLogin
        ? 'impressions,reach,profile_views'
        : 'impressions,reach,profile_views,follower_count,email_contacts,get_directions_clicks,phone_call_clicks,text_message_clicks,website_clicks';

      const response = await axios.get(
        `${apiConfig.baseUrl}/${apiConfig.instagramAccountId}/insights`,
        {
          params: {
            access_token: apiConfig.accessToken,
            metric: metricsToFetch,
            period: 'day',
            since: dateRange.startDate,
            until: dateRange.endDate,
          },
        },
      );

      const metricsData = response.data.data.reduce((acc, metric) => {
        acc[metric.name] = metric.values[0]?.value || 0;
        return acc;
      }, {});

      return {
        followers: metricsData.follower_count || account.followerCount || 0,
        engagement:
          (metricsData.profile_views || 0) + (metricsData.website_clicks || 0),
        impressions: metricsData.impressions || 0,
        reach: metricsData.reach || 0,
        platformSpecific: {
          profileViews: metricsData.profile_views,
          emailContacts: metricsData.email_contacts,
          getDirectionsClicks: metricsData.get_directions_clicks,
          phoneCallClicks: metricsData.phone_call_clicks,
          textMessageClicks: metricsData.text_message_clicks,
          websiteClicks: metricsData.website_clicks,
        },
        dateRange,
      };
    } catch (error) {
      throw new InstagramApiException('Failed to fetch account metrics', error);
    }
  }

  /**
   * Creates a media container with caption for single media or carousel items
   */
  private async createMediaContainer(
    instagramAccountId: string,
    mediaUrl: string,
    caption: string,
    baseUrl: string,
    accessToken: string,
  ): Promise<{ id: string; type: MediaType }> {
    try {
      // Validate and get media type first
      const mediaData = await this.downloadAndValidateMedia(mediaUrl);

      const params: any = {
        access_token: accessToken,
      };

      // Set media URL and type based on media type
      if (mediaData.type === MediaType.IMAGE) {
        params.image_url = mediaUrl;
      } else if (mediaData.type === MediaType.VIDEO) {
        params.video_url = mediaUrl;
      }

      // Add caption only for single media posts (not carousel children)
      if (caption) {
        params.caption = caption;
      }

      const response = await axios.post(
        `${baseUrl}/${instagramAccountId}/media`,
        null,
        { params },
      );

      // Wait for media processing to complete
      await this.waitForMediaProcessing(response.data.id, baseUrl, accessToken);

      return {
        id: response.data.id,
        type: mediaData.type,
      };
    } catch (error) {
      this.logger.error('Failed to create media container', error);
      throw new InstagramApiException(
        'Failed to create media container',
        error,
      );
    }
  }

  /**
   * Creates a carousel container for multiple media items
   */
  private async createCarouselContainer(
    instagramAccountId: string,
    childrenIds: string[],
    caption: string,
    baseUrl: string,
    accessToken: string,
  ): Promise<string> {
    try {
      const params: any = {
        media_type: 'CAROUSEL',
        children: childrenIds.join(','),
        access_token: accessToken,
      };

      if (caption) {
        params.caption = caption;
      }

      const response = await axios.post(
        `${baseUrl}/${instagramAccountId}/media`,
        null,
        { params },
      );

      // Wait for carousel processing to complete
      await this.waitForMediaProcessing(response.data.id, baseUrl, accessToken);

      return response.data.id;
    } catch (error) {
      this.logger.error('Failed to create carousel container', error);
      throw new InstagramApiException(
        'Failed to create carousel container',
        error,
      );
    }
  }

  /**
   * Waits for media processing to complete before publishing
   */
  private async waitForMediaProcessing(
    mediaId: string,
    baseUrl: string,
    accessToken: string,
    maxAttempts: number = 10,
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await axios.get(`${baseUrl}/${mediaId}`, {
          params: {
            fields: 'status_code',
            access_token: accessToken,
          },
        });

        const status = response.data.status_code;

        if (status === 'FINISHED') {
          return;
        } else if (status === 'ERROR') {
          throw new Error('Media processing failed');
        }

        // Wait before next attempt
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw new InstagramApiException('Media processing timeout', error);
        }
      }
    }

    throw new Error('Media processing timeout');
  }

  private async downloadAndValidateMedia(url: string): Promise<{
    type: MediaType;
    mimeType: string;
  }> {
    try {
      const response = await axios.head(url);
      const contentType = response.headers['content-type'];
      const contentLength = parseInt(response.headers['content-length'] || '0');

      // Validate file size (Instagram limit is 8MB for photos, 100MB for videos)
      const maxSize = contentType.startsWith('video/')
        ? 100 * 1024 * 1024
        : 8 * 1024 * 1024;
      if (contentLength > maxSize) {
        throw new HttpException(
          `File size exceeds ${maxSize / (1024 * 1024)}MB limit`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Determine media type
      if (contentType.startsWith('image/')) {
        return { type: MediaType.IMAGE, mimeType: contentType };
      } else if (contentType.startsWith('video/')) {
        return { type: MediaType.VIDEO, mimeType: contentType };
      }

      throw new HttpException('Unsupported media type', HttpStatus.BAD_REQUEST);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to validate media',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async getAccountInsights(accountId: string): Promise<AccountInsights> {
    try {
      const account = await this.instagramRepo.getAccountByUserId(accountId);
      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      const apiConfig = this.getApiConfig(account);

      const response = await axios.get(
        `${apiConfig.baseUrl}/${apiConfig.instagramAccountId}/insights`,
        {
          params: {
            access_token: apiConfig.accessToken,
            metric: 'follower_count,impressions,profile_views,reach',
            period: 'day',
          },
        },
      );

      const insights = response.data.data;

      const accountInsights: AccountInsights = {
        followerCount: this.getInsightValue(insights, 'follower_count'),
        impressions: this.getInsightValue(insights, 'impressions'),
        profileViews: this.getInsightValue(insights, 'profile_views'),
        reach: this.getInsightValue(insights, 'reach'),
      };

      return accountInsights;
    } catch (error) {
      throw new InstagramApiException(
        'Failed to fetch account insights',
        error,
      );
    }
  }

  private getInsightValue(insights: any[], metricName: string): number {
    const insight = insights.find((item) => item.name === metricName);
    return insight ? insight.values[0].value : 0;
  }

  async createStory(
    accountId: string,
    mediaUrl: string,
    stickers?: CreateStoryDto['stickers'],
  ): Promise<PostResponse> {
    try {
      const account = await this.instagramRepo.getAccountByUserId(accountId);
      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      const apiConfig = this.getApiConfig(account);

      // 1. Create media container for story
      const mediaContainer = await this.createMediaContainer(
        apiConfig.instagramAccountId,
        mediaUrl,
        '', // Stories don't use captions
        apiConfig.baseUrl,
        apiConfig.accessToken,
      );

      // 2. Publish story
      const storyParams: any = {
        media_id: mediaContainer.id,
        access_token: apiConfig.accessToken,
      };

      if (stickers) {
        storyParams.stickers = JSON.stringify(stickers);
      }

      const response = await axios.post(
        `${apiConfig.baseUrl}/${apiConfig.instagramAccountId}/media_publish`,
        null,
        { params: storyParams },
      );

      return {
        platformPostId: response.data.id,
        postedAt: new Date(),
      };
    } catch (error) {
      throw new InstagramApiException(
        'Failed to create Instagram story',
        error,
      );
    }
  }

  async revokeAccess(accountId: string): Promise<void> {
    const account = await this.instagramRepo.getAccountByUserId(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    try {
      const apiConfig = this.getApiConfig(account);

      // Revoke access based on authentication method
      if (account.isBusinessLogin) {
        // For Instagram Business Login, revoke via Instagram API
        await axios.post(`${this.instagramGraphUrl}/oauth/revoke`, null, {
          params: {
            client_id: config.get('platforms.instagram.clientId'),
            client_secret: config.get('platforms.instagram.clientSecret'),
            token: apiConfig.accessToken,
          },
        });
      } else {
        // For Facebook Login, revoke via Facebook API
        await axios.delete(`${this.facebookGraphUrl}/me/permissions`, {
          params: {
            access_token: apiConfig.accessToken,
          },
        });
      }

      await this.instagramRepo.deleteAccount(accountId);
    } catch (error) {
      throw new InstagramApiException(
        'Failed to revoke Instagram access',
        error,
      );
    }
  }
}
