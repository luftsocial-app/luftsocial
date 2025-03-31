import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import * as config from 'config';
import { FacebookRepository } from './repositories/facebook.repository';

import {
  CreatePostDto,
  SchedulePagePostDto,
  SchedulePostDto,
  UpdatePageDto,
  UpdatePostDto,
} from './helpers/post.dto';

import {
  CommentResponse,
  MediaItem,
  PlatformService,
  PostResponse,
  SocialAccountDetails,
} from '../platform-service.interface';
import {
  FacebookPageMetrics,
  FacebookPostMetrics,
} from './helpers/facebook.interfaces';
import { FacebookApiException } from './helpers/facebook-api.exception';
import {
  AccountMetrics,
  DateRange,
} from '../../common/interface/platform-metrics.interface';

import { MediaStorageItem } from '../../asset-management/media-storage/media-storage.dto';
import { MediaStorageService } from '../../asset-management/media-storage/media-storage.service';
import { TenantService } from '../../user-management/tenant/tenant.service';
import { FACEBOOK_SCOPES } from '../../common/enums/scopes.enum';
import { FacebookAccount } from '../entities/facebook-entities/facebook-account.entity';
import { FacebookPage } from '../entities/facebook-entities/facebook-page.entity';
import { FacebookPost } from '../entities/facebook-entities/facebook-post.entity';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class FacebookService implements PlatformService {
  private readonly apiVersion = 'v18.0';
  private readonly baseUrl = 'https://graph.facebook.com';

  constructor(
    private readonly facebookRepo: FacebookRepository,
    private readonly mediaStorageService: MediaStorageService,
    private readonly tenantService: TenantService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(FacebookService.name);
  }

  async getComments(
    accountId: string,
    postId: string,
    pageToken?: string,
  ): Promise<CommentResponse> {
    const tenantId = this.tenantService.getTenantId();
    this.facebookRepo.setTenantId(tenantId);

    const post = await this.facebookRepo.getPostById(postId);
    const response = await axios.get(
      `${this.baseUrl}/${this.apiVersion}/${post.postId}/comments`,
      {
        params: {
          access_token: post.page.accessToken,
          fields: 'id,message,created_time,from',
          after: pageToken,
        },
      },
    );

    return {
      items: response.data.data.map((comment) => ({
        id: comment.id,
        content: comment.message,
        authorId: comment.from.id,
        authorName: comment.from.name,
        createdAt: new Date(comment.created_time),
      })),
      nextPageToken: response.data.paging?.cursors?.after,
    };
  }

  async getUserAccounts(userId: string): Promise<SocialAccountDetails[]> {
    const tenantId = this.tenantService.getTenantId();
    this.facebookRepo.setTenantId(tenantId);

    const account = await this.facebookRepo.getAccountById(userId);
    if (!account) {
      throw new NotFoundException('No Facebook accounts found for user');
    }
    try {
      const response = await axios.get(`${this.baseUrl}/me/accounts`, {
        params: {
          access_token: account.socialAccount.accessToken,
          fields: 'id,name,category,picture',
        },
      });

      return response.data.data.map((account) => ({
        id: account.id,
        name: account.name,
        type: account.category,
        avatarUrl: account.picture?.data?.url,
        platformSpecific: {
          category: account.category,
        },
      }));
    } catch (error) {
      throw new FacebookApiException(
        500,
        'Failed to fetch user accounts',
        error,
      );
    }
  }

  private async uploadFacebookMediaItems(
    media: MediaItem[],
    facebookAccountId: string,
    context: 'post' | 'scheduled',
  ): Promise<MediaStorageItem[]> {
    const mediaItems: MediaStorageItem[] = [];

    if (!media?.length) {
      return mediaItems;
    }

    for (const mediaItem of media) {
      const timestamp = Date.now();
      const prefix = `facebook-${context}-${timestamp}`;

      if (mediaItem.file) {
        // For uploaded files
        const uploadedMedia = await this.mediaStorageService.uploadPostMedia(
          facebookAccountId,
          [mediaItem.file],
          prefix,
        );
        mediaItems.push(...uploadedMedia);
      } else if (mediaItem.url) {
        // For media URLs
        const uploadedMedia = await this.mediaStorageService.uploadMediaFromUrl(
          facebookAccountId,
          mediaItem.url,
          prefix,
        );

        mediaItems.push(uploadedMedia);
      }
    }

    return mediaItems;
  }

  async post(
    accountId: string,
    content: string,
    media?: MediaItem[],
  ): Promise<PostResponse> {
    const tenantId = this.tenantService.getTenantId();
    this.facebookRepo.setTenantId(tenantId);

    const account = await this.facebookRepo.getAccountById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    // Store media in S3 first if there are any media items
    const mediaItems = await this.uploadFacebookMediaItems(
      media,
      account.facebookUserId,
      'post',
    );

    // Prepare post data
    const postData: any = { message: content };

    // Handle media attachments
    if (mediaItems?.length) {
      if (mediaItems.length === 1) {
        // If only one media item, use its URL as a link
        postData.link = mediaItems[0].url;
      } else {
        // For multiple media items, upload to Facebook and attach
        const attachments = await Promise.all(
          mediaItems.map((mediaItem) =>
            this.uploadMedia(account.socialAccount.accessToken, mediaItem.url),
          ),
        );
        postData.attached_media = attachments;
      }
    }

    // Post to Facebook
    const response = await axios.post(
      `${this.baseUrl}/${this.apiVersion}/${account.facebookUserId}/feed`,
      postData,
      {
        params: { access_token: account.socialAccount.accessToken },
      },
    );

    await this.facebookRepo.createPost({
      account: account,
      postId: response.data.id,
      content: postData.message,
      mediaItems, // S3 media items
      isPublished: true,
      publishedAt: new Date(),
    });

    return {
      platformPostId: response.data.id,
      postedAt: new Date(),
    };
  }

  async refreshLongLivedToken(token: string): Promise<any> {
    const response = await axios.get(
      `${this.baseUrl}/${this.apiVersion}/oauth/access_token`,
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: config.get('platforms.facebook.clientId'),
          client_secret: config.get('platforms.facebook.clientSecret'),
          fb_exchange_token: token,
        },
      },
    );
    return response.data;
  }

  async refreshPageToken(
    pageId: string,
    userAccessToken: string,
  ): Promise<any> {
    const response = await axios.get(
      `${this.baseUrl}/${this.apiVersion}/${pageId}`,
      {
        params: {
          fields: 'access_token',
          access_token: userAccessToken,
        },
      },
    );
    return {
      access_token: response.data.access_token,
    };
  }

  private async getLongLivedToken(shortLivedToken: string): Promise<any> {
    const response = await axios.get(
      `${this.baseUrl}/${this.apiVersion}/oauth/access_token`,
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: config.get('platforms.facebook.clientId'),
          client_secret: config.get('platforms.facebook.clientSecret'),
          fb_exchange_token: shortLivedToken,
        },
      },
    );
    return response.data;
  }

  async getAccountsByUserId(userId: string): Promise<FacebookAccount> {
    try {
      const tenantId = this.tenantService.getTenantId();
      this.facebookRepo.setTenantId(tenantId);

      return await this.facebookRepo.getAccountById(userId);
    } catch (error) {
      this.logger.error(
        `Failed to fetch Facebook accounts for user ${userId}`,
        error.stack,
      );
    }
  }

  async getUserProfile(accessToken: string): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/${this.apiVersion}/me`, {
      params: {
        access_token: accessToken,
        fields: 'id,name,email',
      },
    });
    return response.data;
  }

  async getPages(accessToken: string): Promise<any[]> {
    const response = await axios.get(
      `${this.baseUrl}/${this.apiVersion}/me/accounts`,
      {
        params: {
          access_token: accessToken,
          fields: 'id,name,category,access_token',
        },
      },
    );
    return response.data.data;
  }

  private async uploadMedia(accessToken: string, url: string): Promise<any> {
    const response = await axios.post(
      `${this.baseUrl}/${this.apiVersion}/photos`,
      { url },
      {
        params: {
          access_token: accessToken,
          published: false,
        },
      },
    );
    return { media_fbid: response.data.id };
  }

  async createPagePost(
    pageId: string,
    createPostDto: CreatePostDto,
  ): Promise<any> {
    const tenantId = this.tenantService.getTenantId();
    this.facebookRepo.setTenantId(tenantId);

    const page = await this.facebookRepo.getPageById(pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // Store media in S3 first if there are any media items
    const mediaItems = await this.uploadFacebookMediaItems(
      createPostDto.media,
      page.facebookAccount.id,
      'post',
    );

    // Use S3 URLs for Facebook post
    const mediaUrls = mediaItems.map((item) => item.url);

    // Post to Facebook
    const postData = await axios.post(
      `${this.baseUrl}/${this.apiVersion}/${page.pageId}/feed`,
      {
        message: createPostDto.content,
        ...(mediaUrls.length && {
          attached_media: await this.processMedia(page.accessToken, mediaUrls),
        }),
      },
      {
        params: { access_token: page.accessToken },
      },
    );

    return this.facebookRepo.createPost({
      page,
      postId: postData.data.id,
      content: createPostDto.content,
      mediaItems, // S3 media items
      isPublished: true,
      publishedAt: new Date(),
    });
  }

  async schedulePost(
    postId: string,
    scheduleDto: SchedulePostDto,
  ): Promise<FacebookPost> {
    const tenantId = this.tenantService.getTenantId();
    this.facebookRepo.setTenantId(tenantId);
    // Retrieve the post and associated page
    const post = await this.facebookRepo.getPostById(postId, ['page']);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const page = await this.facebookRepo.getPageById(post.page.id);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // Upload media to S3 first
    const mediaItems = await this.uploadFacebookMediaItems(
      scheduleDto.media,
      page.facebookAccount.id,
      'scheduled',
    );

    // Prepare media for Facebook scheduling
    const attachedMedia =
      mediaItems.length > 0
        ? await this.processMedia(
            page.accessToken,
            mediaItems.map((m) => m.url),
          )
        : undefined;

    // Schedule the post on Facebook
    const postData = await axios.post(
      `${this.baseUrl}/${this.apiVersion}/${page.pageId}/feed`,
      {
        message: scheduleDto.content,
        published: false,
        scheduled_publish_time: Math.floor(
          new Date(scheduleDto.scheduledTime).getTime() / 1000,
        ),
        ...(attachedMedia && { attached_media: attachedMedia }),
      },
      {
        params: { access_token: page.accessToken },
      },
    );

    // Create post record in repository
    return this.facebookRepo.createPost({
      page,
      postId: postData.data.id,
      content: scheduleDto.content,
      mediaItems: mediaItems,
      isPublished: false,
      scheduledTime: new Date(scheduleDto.scheduledTime),
    });
  }

  async schedulePagePost(scheduleDto: SchedulePagePostDto): Promise<any> {
    const tenantId = this.tenantService.getTenantId();
    this.facebookRepo.setTenantId(tenantId);

    const page = await this.facebookRepo.getPageById(scheduleDto.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // Store media in S3 first
    const mediaItems = await this.uploadFacebookMediaItems(
      scheduleDto.media,
      page.facebookAccount.id,
      'scheduled',
    );

    // Use S3 URLs for Facebook post
    const mediaUrls = mediaItems.map((item) => item.url);

    // Post to Facebook
    const postData = await axios.post(
      `${this.baseUrl}/${this.apiVersion}/${page.pageId}/feed`,
      {
        message: scheduleDto.content,
        published: false,
        scheduled_publish_time:
          new Date(scheduleDto.scheduledTime).getTime() / 1000,
        privacy: scheduleDto.privacyLevel,
        ...(mediaUrls.length && {
          attached_media: await this.processMedia(page.accessToken, mediaUrls),
        }),
      },
      {
        params: { access_token: page.accessToken },
      },
    );

    // Save the post with S3 media details
    return this.facebookRepo.createPost({
      page,
      postId: postData.data.id,
      content: scheduleDto.content,
      mediaItems, // Store full media items
      isPublished: false,
      scheduledTime: new Date(scheduleDto.scheduledTime),
    });
  }

  async getUserPages(userId: string): Promise<FacebookPage[]> {
    const tenantId = this.tenantService.getTenantId();
    this.facebookRepo.setTenantId(tenantId);

    const account = await this.facebookRepo.getAccountById(userId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const existingPages = await this.facebookRepo.getAccountPages(account.id);

    // Refresh pages data from Facebook API
    const response = await axios.get(
      `${this.baseUrl}/${this.apiVersion}/me/accounts`,
      {
        params: {
          access_token: account.socialAccount.accessToken,
          fields: 'id,name,category,access_token,followers_count',
        },
      },
    );

    // Update existing pages with fresh data
    await Promise.all(
      existingPages.map(async (page) => {
        const fbPage = response.data.data.find((p) => p.id === page.pageId);
        if (fbPage) {
          await this.facebookRepo.updatePageToken(page.id, fbPage.access_token);
        }
      }),
    );

    return this.facebookRepo.getAccountPages(account.id);
  }

  async getPagePosts(
    pageId: string,
    limit: number = 10,
    cursor?: string,
  ): Promise<any> {
    const tenantId = this.tenantService.getTenantId();
    this.facebookRepo.setTenantId(tenantId);

    const page = await this.facebookRepo.getPageById(pageId);
    const response = await axios.get(
      `${this.baseUrl}/${this.apiVersion}/${page.pageId}/feed`,
      {
        params: {
          access_token: page.accessToken,
          limit,
          after: cursor,
          fields: 'id,message,created_time,attachments',
        },
      },
    );

    return {
      posts: response.data.data,
      nextCursor: response.data.paging?.cursors?.after,
    };
  }

  async getPageInsights(pageId: string, period: string = '30d'): Promise<any> {
    const tenantId = this.tenantService.getTenantId();
    this.facebookRepo.setTenantId(tenantId);

    const page = await this.facebookRepo.getPageById(pageId);
    const response = await axios.get(
      `${this.baseUrl}/${this.apiVersion}/${page.pageId}/insights`,
      {
        params: {
          access_token: page.accessToken,
          metric: [
            FACEBOOK_SCOPES.PAGE_IMPRESSIONS,
            FACEBOOK_SCOPES.PAGE_ENGAGED_USERS,
            FACEBOOK_SCOPES.PAGE_FAN_ADDS,
            FACEBOOK_SCOPES.PAGE_VIEWS_TOTAL,
            FACEBOOK_SCOPES.PAGE_POST_ENGAGEMENTS,
            FACEBOOK_SCOPES.PAGE_FOLLOWERS,
          ].join(','),
          period,
        },
      },
    );
    return this.transformPageMetrics(response.data.data);
  }

  private transformPageMetrics(data: any[]): FacebookPageMetrics {
    const metrics: any = {};
    data.forEach((metric) => {
      metrics[metric.name] = metric.values[0].value;
    });

    return {
      impressions: metrics.page_impressions || 0,
      engagedUsers: metrics.page_engaged_users || 0,
      newFans: metrics.page_fan_adds || 0,
      pageViews: metrics.page_views_total || 0,
      engagements: metrics.page_post_engagements || 0,
      followers: metrics.page_followers || 0,
      collectedAt: new Date(),
    };
  }

  private transformPostMetrics(data: any[]): FacebookPostMetrics {
    const metrics: any = {};
    data.forEach((metric) => {
      metrics[metric.name] = metric.values[0].value;
    });

    return {
      impressions: metrics.post_impressions || 0,
      engagedUsers: metrics.post_engaged_users || 0,
      reactions: metrics.post_reactions_by_type_total || {},
      clicks: metrics.post_clicks || 0,
      videoViews: metrics.post_video_views || 0,
      videoViewTime: metrics.post_video_view_time || 0,
      collectedAt: new Date(),
    };
  }

  async getPostMetrics(accountId: string, postId: string): Promise<any> {
    try {
      const tenantId = this.tenantService.getTenantId();
      this.facebookRepo.setTenantId(tenantId);
      const account = await this.facebookRepo.getAccountById(accountId);
      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      const post = await this.facebookRepo.getPostById(postId);
      const response = await axios.get(
        `${this.baseUrl}/${this.apiVersion}/${post.postId}/insights`,
        {
          params: {
            access_token: post.page.accessToken,
            metric: [
              FACEBOOK_SCOPES.POST_IMPRESSIONS,
              FACEBOOK_SCOPES.POST_ENGAGED_USERS,
              FACEBOOK_SCOPES.POST_REACTIONS_BY_TYPE_TOTAL,
              FACEBOOK_SCOPES.POST_CLICKS,
              FACEBOOK_SCOPES.POST_VIDEO_VIEWS,
              FACEBOOK_SCOPES.POST_VIDEO_VIEW_TIME,
            ].join(','),
          },
        },
      );

      return this.transformPostMetrics(response.data);
    } catch (error) {
      throw new BadRequestException('Failed to fetch Instagram metrics', error);
    }
  }

  async getPageMetrics(
    pageId: string,
    dateRange: DateRange,
  ): Promise<AccountMetrics> {
    const tenantId = this.tenantService.getTenantId();
    this.facebookRepo.setTenantId(tenantId);

    const page = await this.facebookRepo.getPageById(pageId);
    if (!page) {
      throw new NotFoundException('Account not found');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/${pageId}/insights`, {
        params: {
          access_token: page.accessToken,
          metric: [
            FACEBOOK_SCOPES.PAGE_IMPRESSIONS,
            FACEBOOK_SCOPES.PAGE_ENGAGED_USERS,
            FACEBOOK_SCOPES.PAGE_FAN_ADDS,
            FACEBOOK_SCOPES.PAGE_VIEWS_TOTAL,
            FACEBOOK_SCOPES.PAGE_FOLLOWERS_ADDS,
          ].join(','),
          period: 'day',
          since: dateRange.startDate,
          until: dateRange.endDate,
        },
      });

      return {
        followers: response.data.page_followers_adds || 0,
        engagement: response.data.page_engaged_users || 0,
        impressions: response.data.page_impressions || 0,
        reach: response.data.page_impressions_unique || 0,
        platformSpecific: {
          pageViews: response.data.page_views_total,
          fanAdds: response.data.page_fan_adds,
        },
        dateRange,
      };
    } catch (error) {
      throw new FacebookApiException(
        500,
        'Failed to fetch account metrics',
        error,
      );
    }
  }

  async editPost(
    postId: string,
    updateDto: UpdatePostDto,
  ): Promise<FacebookPost> {
    const tenantId = this.tenantService.getTenantId();
    this.facebookRepo.setTenantId(tenantId);
    // Retrieve the post with its associated page
    const post = await this.facebookRepo.getPostById(postId, ['page']);
    if (!post) throw new NotFoundException('Post not found');

    try {
      // Upload media to S3 first
      const mediaItems = await this.uploadFacebookMediaItems(
        updateDto.media,
        post.account.id,
        'post',
      );

      // Prepare media for Facebook update
      const attachedMedia =
        mediaItems.length > 0
          ? await this.processMedia(
              post.page.accessToken,
              mediaItems.map((m) => m.url),
            )
          : undefined;

      // Update post on Facebook
      await axios.post(
        `${this.baseUrl}/${this.apiVersion}/${post.postId}`,
        {
          message: updateDto.content,
          ...(attachedMedia && { attached_media: attachedMedia }),
        },
        {
          params: { access_token: post.page.accessToken },
        },
      );

      // Update post in repository
      return this.facebookRepo.updatePost(postId, {
        content: updateDto.content,
        mediaItems: mediaItems,
        updatedAt: new Date(),
      });
    } catch (error) {
      throw new HttpException(
        'Failed to update Facebook post',
        HttpStatus.BAD_REQUEST,
        { cause: error },
      );
    }
  }

  async editPage(
    pageId: string,
    updateDto: UpdatePageDto,
  ): Promise<FacebookPage> {
    const tenantId = this.tenantService.getTenantId();
    this.facebookRepo.setTenantId(tenantId);

    const page = await this.facebookRepo.getPageById(pageId);
    if (!page) throw new NotFoundException('Page not found');

    try {
      // Update page settings in Facebook
      await axios.post(
        `${this.baseUrl}/${this.apiVersion}/${page.pageId}`,
        {
          about: updateDto.about,
          description: updateDto.description,
          ...(updateDto.pageInfo && {
            website: updateDto.pageInfo.website,
            phone: updateDto.pageInfo.phone,
            location: updateDto.pageInfo.location,
          }),
        },
        {
          params: { access_token: page.accessToken },
        },
      );

      // Update local database
      return this.facebookRepo.updatePage(pageId, {
        name: updateDto.name || page.name,
        category: updateDto.category || page.category,
        about: updateDto.about,
        description: updateDto.description,
        metadata: {
          ...page.metadata,
          ...updateDto.pageInfo,
        },
      });
    } catch (error) {
      throw new HttpException(
        'Failed to update Facebook page',
        HttpStatus.BAD_REQUEST,
        error,
      );
    }
  }

  async revokeAccess(accountId: string): Promise<void> {
    const tenantId = this.tenantService.getTenantId();
    this.facebookRepo.setTenantId(tenantId);

    const account = await this.facebookRepo.getAccountById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    try {
      await axios.post(`${this.baseUrl}/oauth/revoke/`, null, {
        params: {
          client_key: config.get('platforms.facebook.clientId'),
          client_secret: config.get('platforms.facebook.clientSecret'),
          token: account.socialAccount.accessToken,
        },
      });

      await this.facebookRepo.deleteAccount(accountId);
    } catch (error) {
      throw new FacebookApiException(
        500,
        'Failed to revoke Facebook access',
        error,
      );
    }
  }

  async deletePost(postId: string): Promise<void> {
    const tenantId = this.tenantService.getTenantId();
    this.facebookRepo.setTenantId(tenantId);

    const post = await this.facebookRepo.getPostById(postId);
    await axios.delete(`${this.baseUrl}/${this.apiVersion}/${post.postId}`, {
      params: { access_token: post.page.accessToken },
    });
    await this.facebookRepo.deletePost(postId);
  }

  private async processMedia(
    accessToken: string,
    mediaUrls: string[],
  ): Promise<any[]> {
    const mediaPromises = mediaUrls.map(async (url) => {
      const uploadResponse = await axios.post(
        `${this.baseUrl}/${this.apiVersion}/photos`,
        { url },
        {
          params: {
            access_token: accessToken,
            published: false,
          },
        },
      );
      return { media_fbid: uploadResponse.data.id };
    });

    return Promise.all(mediaPromises);
  }
}
