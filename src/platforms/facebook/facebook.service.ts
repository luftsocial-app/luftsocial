import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { FacebookRepository } from './repositories/facebook.repository';
import { FacebookPage } from './entity/facebook-page.entity';
import {
  CreatePostDto,
  SchedulePagePostDto,
  SchedulePostDto,
  UpdatePageDto,
  UpdatePostDto,
} from './helpers/post.dto';
import { FacebookPost } from './entity/facebook-post.entity';
import {
  CommentResponse,
  PlatformService,
  TokenResponse,
} from '../platform-service.interface';

@Injectable()
export class FacebookService implements PlatformService {
  private readonly logger = new Logger(FacebookService.name);
  private readonly apiVersion = 'v18.0';
  private readonly baseUrl = 'https://graph.facebook.com';

  constructor(
    private readonly configService: ConfigService,
    private readonly facebookRepo: FacebookRepository,
  ) {}

  async authorize(userId: string): Promise<string> {
    const state = await this.facebookRepo.createAuthState(userId);

    const params = new URLSearchParams({
      client_id: this.configService.get('FACEBOOK_CLIENT_ID'),
      redirect_uri: this.configService.get('FACEBOOK_REDIRECT_URI'),
      state,
      scope: [
        'pages_manage_posts',
        'pages_read_engagement',
        'pages_show_list',
        'publish_to_groups',
      ].join(','),
    });

    return `https://www.facebook.com/${this.apiVersion}/dialog/oauth?${params}`;
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const tokens = await this.refreshLongLivedToken(refreshToken);
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      tokenType: 'bearer',
      scope: tokens.scope.split(','),
    };
  }

  async getComments(
    accountId: string,
    postId: string,
    pageToken?: string,
  ): Promise<CommentResponse> {
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

  async handleCallback(
    code: string,
    state: string,
    userId: string,
  ): Promise<any> {
    const token = await this.exchangeCodeForToken(code);
    const longLivedToken = await this.getLongLivedToken(token.access_token);
    const userProfile = await this.getUserProfile(longLivedToken.access_token);
    const pages = await this.getPages(longLivedToken.access_token);

    return {
      accessToken: longLivedToken.access_token,
      expiresIn: longLivedToken.expires_in,
      userData: userProfile,
      pages,
    };
  }

  async post(
    accountId: string,
    content: string,
    mediaUrls?: string[],
  ): Promise<any> {
    const account = await this.facebookRepo.getAccountById(accountId);
    if (!account) throw new Error('Account not found');

    const postData: any = { message: content };

    if (mediaUrls?.length) {
      if (mediaUrls.length === 1) {
        postData.link = mediaUrls[0];
      } else {
        const attachments = await Promise.all(
          mediaUrls.map((url) => this.uploadMedia(account.accessToken, url)),
        );
        postData.attached_media = attachments;
      }
    }

    const response = await axios.post(
      `${this.baseUrl}/${this.apiVersion}/${account.facebookUserId}/feed`,
      postData,
      {
        params: { access_token: account.accessToken },
      },
    );

    return {
      platformPostId: response.data.id,
      postedAt: new Date(),
    };
  }

  async getMetrics(postId: string): Promise<any> {
    const post = await this.facebookRepo.getPostById(postId);
    if (!post) throw new Error('Post not found');

    const response = await axios.get(
      `${this.baseUrl}/${this.apiVersion}/${post.postId}/insights`,
      {
        params: {
          access_token: post.page.accessToken,
          metric: [
            'post_impressions',
            'post_engagements',
            'post_reactions_by_type_total',
          ].join(','),
        },
      },
    );

    return this.processMetricsResponse(response.data);
  }

  async refreshLongLivedToken(token: string): Promise<any> {
    const response = await axios.get(
      `${this.baseUrl}/${this.apiVersion}/oauth/access_token`,
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: this.configService.get('FACEBOOK_CLIENT_ID'),
          client_secret: this.configService.get('FACEBOOK_CLIENT_SECRET'),
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

  private async exchangeCodeForToken(code: string): Promise<any> {
    const response = await axios.get(
      `${this.baseUrl}/${this.apiVersion}/oauth/access_token`,
      {
        params: {
          client_id: this.configService.get('FACEBOOK_CLIENT_ID'),
          client_secret: this.configService.get('FACEBOOK_CLIENT_SECRET'),
          redirect_uri: this.configService.get('FACEBOOK_REDIRECT_URI'),
          code,
        },
      },
    );
    return response.data;
  }

  private async getLongLivedToken(shortLivedToken: string): Promise<any> {
    const response = await axios.get(
      `${this.baseUrl}/${this.apiVersion}/oauth/access_token`,
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: this.configService.get('FACEBOOK_CLIENT_ID'),
          client_secret: this.configService.get('FACEBOOK_CLIENT_SECRET'),
          fb_exchange_token: shortLivedToken,
        },
      },
    );
    return response.data;
  }

  private async getUserProfile(accessToken: string): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/${this.apiVersion}/me`, {
      params: {
        access_token: accessToken,
        fields: 'id,name,email',
      },
    });
    return response.data;
  }

  private async getPages(accessToken: string): Promise<any[]> {
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

  private processMetricsResponse(data: any): any {
    const metrics = {};
    data.data.forEach((metric) => {
      metrics[metric.name] = metric.values[0].value;
    });
    return metrics;
  }

  async createPagePost(
    pageId: string,
    createPostDto: CreatePostDto,
  ): Promise<FacebookPost> {
    const page = await this.facebookRepo.getPageById(pageId);
    if (!page) throw new NotFoundException('Page not found');

    const postData = await axios.post(
      `${this.baseUrl}/${this.apiVersion}/${page.pageId}/feed`,
      {
        message: createPostDto.content,
        ...(createPostDto.media && {
          attached_media: await this.processMedia(
            page.accessToken,
            createPostDto.media.map((m) => m.url),
          ),
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
      mediaUrls: createPostDto.media?.map((m) => m.url) || [],
      isPublished: true,
      publishedAt: new Date(),
    });
  }

  async schedulePost(
    postId: string,
    scheduleDto: SchedulePostDto,
  ): Promise<FacebookPost> {
    const post = await this.facebookRepo.getPostById(postId, ['page']);
    if (!post) throw new NotFoundException('Post not found');

    const page = await this.facebookRepo.getPageById(post.page.id);
    if (!page) throw new NotFoundException('Page not found');

    const postData = await axios.post(
      `${this.baseUrl}/${this.apiVersion}/${page.pageId}/feed`,
      {
        message: scheduleDto.content,
        published: false,
        scheduled_publish_time:
          new Date(scheduleDto.scheduledTime).getTime() / 1000,
        ...(scheduleDto.media && {
          attached_media: await this.processMedia(
            page.accessToken,
            scheduleDto.media.map((m) => m.url),
          ),
        }),
      },
      {
        params: { access_token: page.accessToken },
      },
    );

    return this.facebookRepo.createPost({
      page,
      postId: postData.data.id,
      content: scheduleDto.content,
      mediaUrls: scheduleDto.media?.map((m) => m.url) || [],
      isPublished: false,
      scheduledTime: new Date(scheduleDto.scheduledTime),
    });
  }

  async schedulePagePost(
    scheduleDto: SchedulePagePostDto,
  ): Promise<FacebookPost> {
    const page = await this.facebookRepo.getPageById(scheduleDto.pageId);
    if (!page) throw new NotFoundException('Page not found');

    const postData = await axios.post(
      `${this.baseUrl}/${this.apiVersion}/${page.pageId}/feed`,
      {
        message: scheduleDto.content,
        published: false,
        scheduled_publish_time:
          new Date(scheduleDto.scheduledTime).getTime() / 1000,
        privacy: scheduleDto.privacyLevel,
        ...(scheduleDto.media && {
          attached_media: await this.processMedia(
            page.accessToken,
            scheduleDto.media.map((m) => m.url),
          ),
        }),
      },
      {
        params: { access_token: page.accessToken },
      },
    );

    return this.facebookRepo.createPost({
      page,
      postId: postData.data.id,
      content: scheduleDto.content,
      mediaUrls: scheduleDto.media?.map((m) => m.url) || [],
      isPublished: false,
      scheduledTime: new Date(scheduleDto.scheduledTime),
    });
  }

  async getUserPages(userId: string): Promise<FacebookPage[]> {
    const account = await this.facebookRepo.getAccountById(userId);
    if (!account) throw new NotFoundException('Account not found');

    const existingPages = await this.facebookRepo.getAccountPages(account.id);

    // Refresh pages data from Facebook API
    const response = await axios.get(
      `${this.baseUrl}/${this.apiVersion}/me/accounts`,
      {
        params: {
          access_token: account.accessToken,
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
    const page = await this.facebookRepo.getPageById(pageId);
    const response = await axios.get(
      `${this.baseUrl}/${this.apiVersion}/${page.pageId}/insights`,
      {
        params: {
          access_token: page.accessToken,
          metric: [
            'page_impressions',
            'page_engaged_users',
            'page_fan_adds',
            'page_views_total',
          ].join(','),
          period,
        },
      },
    );

    return response.data.data;
  }

  async getPostMetrics(postId: string): Promise<any> {
    const post = await this.facebookRepo.getPostById(postId);
    const response = await axios.get(
      `${this.baseUrl}/${this.apiVersion}/${post.postId}/insights`,
      {
        params: {
          access_token: post.page.accessToken,
          metric: [
            'post_impressions',
            'post_engagements',
            'post_reactions_by_type_total',
          ].join(','),
        },
      },
    );

    return this.processMetricsResponse(response.data);
  }

  async editPost(
    postId: string,
    updateDto: UpdatePostDto,
  ): Promise<FacebookPost> {
    const post = await this.facebookRepo.getPostById(postId, ['page']);
    if (!post) throw new NotFoundException('Post not found');

    try {
      await axios.post(
        `${this.baseUrl}/${this.apiVersion}/${post.postId}`,
        {
          message: updateDto.content,
          ...(updateDto.media && {
            attached_media: await this.processMedia(
              post.page.accessToken,
              updateDto.media.map((m) => m.url),
            ),
          }),
        },
        {
          params: { access_token: post.page.accessToken },
        },
      );

      return this.facebookRepo.updatePost(postId, {
        content: updateDto.content,
        mediaUrls: updateDto.media?.map((m) => m.url) || post.mediaUrls,
        updatedAt: new Date(),
      });
    } catch (error) {
      throw new HttpException(
        'Failed to update Facebook post',
        HttpStatus.BAD_REQUEST,
        error,
      );
    }
  }

  async editPage(
    pageId: string,
    updateDto: UpdatePageDto,
  ): Promise<FacebookPage> {
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

  async deletePost(postId: string): Promise<void> {
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
