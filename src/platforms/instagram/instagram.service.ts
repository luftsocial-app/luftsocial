// src/platforms/instagram/services/instagram.service.ts
import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { InstagramRepository } from './repositories/instagram.repository';
import { InstagramApiException } from './helpers/instagram-api.exception';
import { InstagramConfig } from './helpers/instagram.config';
import { MediaType } from './helpers/media-type.enum';
import {
  CommentResponse,
  PlatformService,
  PostResponse,
  SocialAccountDetails,
} from '../platform-service.interface';
import { AccountInsights } from './helpers/instagram-account.interface';
import { CreateStoryDto } from './helpers/create-content.dto';
import {
  AccountMetrics,
  DateRange,
  PostMetrics,
} from 'src/cross-platform/helpers/cross-platform.interface';
import { InstagramAccount } from './entities/instagram-account.entity';

@Injectable()
export class InstagramService implements PlatformService {
  private readonly baseUrl: string = 'https://graph.facebook.com/v18.0';
  private readonly logger = new Logger(InstagramService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly instagramConfig: InstagramConfig,
    private readonly instagramRepo: InstagramRepository,
  ) {}

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
        `Failed to fetch Facebook accounts for user ${userId}`,
        error.stack,
      );
    }
  }

  async getUserAccounts(userId: string): Promise<SocialAccountDetails[]> {
    const account = await this.instagramRepo.getAccountByUserId(userId);
    if (!account) {
      throw new NotFoundException('No Instagram accounts found for user');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/me/accounts`, {
        params: {
          access_token: account.accessToken,
          fields: 'id,username,profile_picture_url,account_type',
        },
      });

      return response.data.data.map((account) => ({
        id: account.id,
        name: account.username,
        type: account.account_type,
        avatarUrl: account.profile_picture_url,
        platformSpecific: {
          accountType: account.account_type,
        },
      }));
    } catch (error) {
      throw new InstagramApiException('Failed to fetch user accounts', error);
    }
  }

  async post(
    accountId: string,
    content: string,
    mediaUrls?: string[],
  ): Promise<PostResponse> {
    try {
      const account = await this.instagramRepo.getAccountByUserId(accountId);
      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      const igAccountId = account.metadata.instagramAccounts[0].id;

      if (!mediaUrls?.length) {
        throw new HttpException(
          'Instagram requires at least one media item',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 1. Upload media
      const mediaObjects = await Promise.all(
        mediaUrls.map((url) =>
          this.uploadMedia(igAccountId, url, account.accessToken),
        ),
      );

      // 2. Create container if multiple media items
      let containerId: string;
      if (mediaObjects.length > 1) {
        containerId = await this.createMediaContainer(
          igAccountId,
          mediaObjects.map((m) => m.id),
          account.accessToken,
        );
      }

      // 3. Publish post
      const response = await axios.post(
        `${this.baseUrl}/${igAccountId}/media_publish`,
        null,
        {
          params: {
            creation_id: containerId || mediaObjects[0].id,
            access_token: account.accessToken,
          },
        },
      );

      return {
        platformPostId: response.data.id,
        postedAt: new Date(),
      };
    } catch (error) {
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

      const response = await axios.get(`${this.baseUrl}/${postId}/comments`, {
        params: {
          access_token: account.accessToken,
          fields: 'id,text,timestamp,username',
          after: pageToken,
        },
      });

      return {
        items: response.data.data.map((comment) => ({
          id: comment.id,
          content: comment.text,
          authorId: comment.username,
          authorName: comment.username,
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

      const response = await axios.get(`${this.baseUrl}/${postId}/insights`, {
        params: {
          access_token: account.accessToken,
          metric:
            'engagement,impressions,reach,saved,likes_count,comments_count,shares',
          period: 'lifetime',
        },
      });

      const metrics: Record<string, number> = {};
      response.data.data.forEach((metric) => {
        metrics[metric.name] = metric.values[0].value;
      });

      return {
        engagement: metrics.engagement || 0,
        impressions: metrics.impressions || 0,
        reach: metrics.reach || 0,
        reactions: metrics.likes_count || 0,
        comments: metrics.comments_count || 0,
        shares: metrics.shares || 0,
        saves: metrics.saved || 0,
        platformSpecific: {
          // Instagram specific metrics can go here
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
    if (!account) throw new NotFoundException('Account not found');

    try {
      const response = await axios.get(`${this.baseUrl}/insights`, {
        params: {
          access_token: account.socialAccount.accessToken,
          metric: [
            'impressions',
            'reach',
            'profile_views',
            'follower_count',
            'email_contacts',
            'get_directions_clicks',
            'phone_call_clicks',
            'text_message_clicks',
            'website_clicks',
          ].join(','),
          period: 'day',
          since: dateRange.startDate,
          until: dateRange.endDate,
        },
      });

      return {
        followers: response.data.follower_count || 0,
        engagement:
          (response.data.profile_views || 0) +
          (response.data.website_clicks || 0),
        impressions: response.data.impressions || 0,
        reach: response.data.reach || 0,
        platformSpecific: {
          profileViews: response.data.profile_views,
          emailContacts: response.data.email_contacts,
          getDirectionsClicks: response.data.get_directions_clicks,
          phoneCallClicks: response.data.phone_call_clicks,
          textMessageClicks: response.data.text_message_clicks,
          websiteClicks: response.data.website_clicks,
        },
        dateRange,
      };
    } catch (error) {
      throw new InstagramApiException('Failed to fetch account metrics', error);
    }
  }

  private async getInstagramAccounts(accessToken: string): Promise<any[]> {
    // First get Facebook Pages
    const pagesResponse = await axios.get(`${this.baseUrl}/me/accounts`, {
      params: {
        access_token: accessToken,
        fields: 'instagram_business_account{id,username}',
      },
    });

    // Extract Instagram Business Accounts
    const instagramAccounts = [];
    for (const page of pagesResponse.data.data) {
      if (page.instagram_business_account) {
        instagramAccounts.push({
          id: page.instagram_business_account.id,
          username: page.instagram_business_account.username,
          pageId: page.id,
        });
      }
    }

    return instagramAccounts;
  }

  private async uploadMedia(
    igAccountId: string,
    mediaUrl: string,
    accessToken: string,
  ): Promise<{ id: string; type: MediaType }> {
    try {
      // 1. Download media
      const mediaData = await this.downloadAndValidateMedia(mediaUrl);

      // 2. Create container
      const containerResponse = await axios.post(
        `${this.baseUrl}/${igAccountId}/media`,
        null,
        {
          params: {
            image_url: mediaUrl,
            media_type: mediaData.type,
            access_token: accessToken,
          },
        },
      );

      // 3. Check status
      const status = await this.checkMediaStatus(
        containerResponse.data.id,
        accessToken,
      );

      if (status !== 'FINISHED') {
        throw new Error('Media upload failed');
      }

      return {
        id: containerResponse.data.id,
        type: mediaData.type,
      };
    } catch (error) {
      throw new InstagramApiException('Failed to upload media', error);
    }
  }

  private async createMediaContainer(
    igAccountId: string,
    mediaIds: string[],
    accessToken: string,
  ): Promise<string> {
    const response = await axios.post(
      `${this.baseUrl}/${igAccountId}/media`,
      null,
      {
        params: {
          media_type: 'CAROUSEL',
          children: mediaIds.join(','),
          access_token: accessToken,
        },
      },
    );

    return response.data.id;
  }

  private async checkMediaStatus(
    mediaId: string,
    accessToken: string,
  ): Promise<string> {
    const response = await axios.get(`${this.baseUrl}/${mediaId}`, {
      params: {
        fields: 'status_code',
        access_token: accessToken,
      },
    });

    return response.data.status_code;
  }

  private async downloadAndValidateMedia(url: string): Promise<{
    type: MediaType;
    mimeType: string;
  }> {
    const response = await axios.head(url);
    const contentType = response.headers['content-type'];
    const contentLength = parseInt(response.headers['content-length']);

    // Validate file size (Instagram limit is 8MB)
    if (contentLength > 8 * 1024 * 1024) {
      throw new HttpException(
        'File size exceeds 8MB limit',
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
  }

  async getAccountInsights(accountId: string): Promise<AccountInsights> {
    try {
      const account = await this.instagramRepo.getAccountByUserId(accountId);
      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      const igAccountId = account.instagramAccountId;
      const accessToken = account.accessToken;

      const response = await axios.get(
        `${this.baseUrl}/${igAccountId}/insights`,
        {
          params: {
            access_token: accessToken,
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

      const igAccountId = account.instagramAccountId;
      const accessToken = account.accessToken;

      // 1. Upload media
      const mediaContainer = await this.uploadMedia(
        igAccountId,
        mediaUrl,
        accessToken,
      );

      // 2. Configure story
      const configureStoryParams = {
        media_id: mediaContainer.id,
        source_type: '3',
        configure_mode: '1',
        stickers: stickers ? JSON.stringify(stickers) : undefined,
      };

      const configureStoryResponse = await axios.post(
        `${this.baseUrl}/${igAccountId}/media_configure_to_story`,
        null,
        {
          params: {
            ...configureStoryParams,
            access_token: accessToken,
          },
        },
      );

      return {
        platformPostId: configureStoryResponse.data.id,
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
    if (!account) throw new NotFoundException('Account not found');

    try {
      await axios.post(`${this.baseUrl}/oauth/revoke/`, null, {
        params: {
          client_key: this.configService.get('INSTAGRAM_CLIENT_KEY'),
          client_secret: this.configService.get('INSTAGRAM_CLIENT_SECRET'),
          token: account.socialAccount.accessToken,
        },
      });

      await this.instagramRepo.deleteAccount(accountId);
    } catch (error) {
      throw new InstagramApiException(
        'Failed to revoke Instagram access',
        error,
      );
    }
  }
}
