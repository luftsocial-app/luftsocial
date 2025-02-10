// src/platforms/instagram/services/instagram.service.ts
import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
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
  TokenResponse,
} from '../platform-service.interface';
import {
  AccountInsights,
  InstagramTokenResponse,
} from './helpers/instagram-account.interface';
import { CreateStoryDto } from './helpers/create-content.dto';

@Injectable()
export class InstagramService implements PlatformService {
  private readonly baseUrl: string = 'https://graph.facebook.com/v18.0';

  constructor(
    private readonly configService: ConfigService,
    private readonly instagramRepo: InstagramRepository,
    private readonly instagramConfig: InstagramConfig,
  ) {}

  async authorize(userId: string): Promise<string> {
    const state = await this.instagramRepo.createAuthState(userId);
    return this.instagramConfig.getAuthUrl(state);
  }

  async handleCallback(code: string): Promise<InstagramTokenResponse> {
    try {
      // Exchange code for access token (through Facebook OAuth)
      const tokenResponse = await this.exchangeCodeForToken(code);

      // Get Instagram Business Account ID
      const instagramAccounts = await this.getInstagramAccounts(
        tokenResponse.access_token,
      );

      if (!instagramAccounts.length) {
        throw new HttpException(
          'No Instagram Business account found',
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresIn: tokenResponse.expires_in,
        tokenType: 'bearer',
        scope: tokenResponse.scope.split(','),
        metadata: {
          instagramAccounts,
        },
      };
    } catch {
      throw new InstagramApiException('Failed to handle Instagram callback');
    }
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

  async refreshToken(accountId: string): Promise<TokenResponse> {
    const account = await this.instagramRepo.getAccountByUserId(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/refresh_access_token`, {
        params: {
          grant_type: 'ig_refresh_token',
          access_token: account.socialAccount.accessToken,
        },
      });

      const newToken = {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
      };

      // Update the token in the database
      await this.instagramRepo.updateToken(accountId, newToken);

      return {
        accessToken: newToken.accessToken,
        refreshToken: null, // Instagram doesn't provide refresh tokens
        expiresIn: newToken.expiresIn,
        tokenType: 'bearer',
        scope: ['basic', 'comments', 'relationships', 'media'], // Add appropriate Instagram scopes
      };
    } catch {
      throw new HttpException(
        'Failed to refresh Instagram token',
        HttpStatus.BAD_REQUEST,
      );
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

  async getMetrics(
    accountId: string,
    postId: string,
  ): Promise<Record<string, any>> {
    try {
      const account = await this.instagramRepo.getAccountByUserId(accountId);
      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      const response = await axios.get(`${this.baseUrl}/${postId}/insights`, {
        params: {
          access_token: account.accessToken,
          metric: 'engagement,impressions,reach,saved',
          period: 'lifetime',
        },
      });

      const metrics = {};
      response.data.data.forEach((metric) => {
        metrics[metric.name] = metric.values[0].value;
      });

      return metrics;
    } catch (error) {
      throw new InstagramApiException(
        'Failed to fetch Instagram metrics',
        error,
      );
    }
  }

  private async exchangeCodeForToken(code: string): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/oauth/access_token`, {
      params: {
        client_id: this.instagramConfig.clientId,
        client_secret: this.instagramConfig.clientSecret,
        redirect_uri: this.instagramConfig.redirectUri,
        code,
      },
    });
    return response.data;
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
}
