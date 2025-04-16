import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import * as FormData from 'form-data';
import * as config from 'config';
import { FacebookRepository } from './repositories/facebook.repository';

import {
  CreateFacebookPagePostDto,
  UpdatePageDto,
  UpdatePostDto,
} from './helpers/post.dto';

import {
  MediaItem,
  PlatformService,
  SocialAccountDetails,
} from '../platform-service.interface';
import {
  FacebookPostMetrics,
  PageInsightsResult,
} from './helpers/facebook.interfaces';
import { FacebookApiException } from './helpers/facebook-api.exception';
import {
  AccountMetrics,
  DateRange,
  PaginatedResponse,
} from '../../common/interface/platform-metrics.interface';

import { MediaStorageItem } from '../../asset-management/media-storage/media-storage.dto';
import { MediaStorageService } from '../../asset-management/media-storage/media-storage.service';
import { FACEBOOK_SCOPES } from '../../common/enums/scopes.enum';
import { FacebookAccount } from '../entities/facebook-entities/facebook-account.entity';
import { FacebookPage } from '../entities/facebook-entities/facebook-page.entity';
import { FacebookPost } from '../entities/facebook-entities/facebook-post.entity';
import { PinoLogger } from 'nestjs-pino';
import { SocialPlatform } from '../../common/enums/social-platform.enum';
import { MediaType } from '../../common/enums/media-type.enum';
import { TenantService } from '../../user-management/tenant.service';

@Injectable()
export class FacebookService implements PlatformService {
  private readonly apiVersion = 'v22.0';
  private readonly baseUrl = 'https://graph.facebook.com';
  private readonly videoUrl = 'https://graph-video.facebook.com';

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
  ): Promise<PaginatedResponse<Comment>> {
    try {
      // First, ensure we have a valid access token
      const account = await this.facebookRepo.getAccountById(accountId);
      if (!account) {
        throw new NotFoundException(`Facebook page not found: ${accountId}`);
      }

      // Make sure we have a valid access token
      const accessToken = account.socialAccount.accessToken;
      if (!accessToken) {
        throw new UnauthorizedException(
          'No access token available for this Facebook page',
        );
      }

      // Verify that postId is valid
      if (!postId) {
        throw new BadRequestException('Post ID is required');
      }

      // Construct the API URL according to Facebook's latest documentation
      const apiUrl = `https://graph.facebook.com/v22.0/${postId}/comments`;

      // Prepare request parameters with the fields we need
      // According to the Facebook documentation, we need from, message, and created_time
      const params: Record<string, string> = {
        access_token: accessToken,
        fields: 'from,message,created_time',
        limit: '25', // Set a reasonable limit
      };

      // Add pagination token if provided and not empty
      if (pageToken && pageToken.trim() !== '') {
        params.after = pageToken;
      }

      // Make the API request using axios
      const response = await axios.get(apiUrl, { params });

      // Extract the data from the response
      const { data, paging } = response.data;

      // Map the Facebook data to our Comment model
      const comments: Comment[] = data.map((item: any) => ({
        id: item.id,
        content: item.message || '',
        createdAt: new Date(item.created_time),
        author: item.from
          ? {
              id: item.from.id,
              name: item.from.name,
              // Note: Facebook no longer returns picture in this endpoint
              picture: null,
            }
          : null,
      }));

      // Return paginated response
      return {
        data: comments,
        pagination: {
          nextToken: paging?.cursors?.after || null,
          hasMore: !!paging?.next,
        },
      };
    } catch (error) {
      // Improved error handling with specific error types and clearer messages
      if (axios.isAxiosError(error) && error.response) {
        const fbError = error.response.data?.error;

        if (fbError) {
          throw new BadRequestException({
            message: `Facebook API error: ${fbError.message}`,
            code: fbError.code,
            type: fbError.type,
            subcode: fbError.error_subcode || null,
          });
        }

        // Handle specific error status codes
        if (error.response.status === 400) {
          throw new BadRequestException(
            'Invalid request to Facebook API. Check your parameters.',
          );
        } else if (
          error.response.status === 401 ||
          error.response.status === 403
        ) {
          throw new UnauthorizedException(
            'Access token is invalid or has insufficient permissions.',
          );
        }
      }

      // Forward the exception with context
      throw new InternalServerErrorException(
        `Failed to fetch comments for post ${postId}: ${error.message}`,
        error,
      );
    }
  }

  async getUserAccounts(userId: string): Promise<SocialAccountDetails[]> {
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

  /**
   * Get S3 URL from key and bucket
   */
  getS3Url(s3Key: string, s3Bucket?: string): string {
    const bucket = s3Bucket || config.get('aws.s3.bucket');
    return `https://${bucket}.s3.amazonaws.com/${s3Key}`;
  }

  /**
   * Upload and process media items for Facebook posts
   * Supports direct file uploads, URL references, and presigned URLs
   */
  private async uploadFacebookMediaItems(
    media: MediaItem[],
    facebookAccountId: string,
    context: 'post' | 'scheduled',
  ): Promise<MediaStorageItem[]> {
    if (!media?.length) {
      return [];
    }

    const uploadPromises = media.map(async (mediaItem) => {
      const timestamp = Date.now();
      const prefix = `facebook-${context}-${timestamp}`;

      // Handle different media source types
      if (mediaItem.file) {
        // Case 1: Direct file upload
        const uploadedMedia = await this.mediaStorageService.uploadPostMedia(
          facebookAccountId,
          [mediaItem.file],
          prefix,
          SocialPlatform.FACEBOOK,
        );
        return uploadedMedia;
      } else if (mediaItem.s3Key) {
        // Case 2: Already uploaded to S3 via presigned URL
        const storageItem: MediaStorageItem = {
          url: this.getS3Url(mediaItem.s3Key, mediaItem.s3Bucket),
          key: mediaItem.s3Key,
          type: mediaItem.type,
          mimeType: mediaItem.contentType,
        };
        return [storageItem];
      } else if (mediaItem.url) {
        // Case 3: Media from URL
        const uploadedMedia = await this.mediaStorageService.uploadMediaFromUrl(
          facebookAccountId,
          mediaItem.url,
          prefix,
          SocialPlatform.FACEBOOK,
        );
        return uploadedMedia;
      } else {
        this.logger.warn('Invalid media item provided', mediaItem);
        throw new BadRequestException(
          'Invalid media item: must provide file, url, or s3Key',
        );
      }
    });

    const results = await Promise.all(uploadPromises);

    const mediaItems = results.flat();

    this.logger.debug('Media items processed successfully', {
      count: mediaItems.length,
    });
    return mediaItems;
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

  /**
   * Unified method to create a post on a Facebook Page
   * Handles text posts, link posts, photo posts, video posts, and scheduled posts
   */
  async createPagePost(
    pageId: string,
    createPostDto: CreateFacebookPagePostDto,
  ): Promise<any> {
    const tenantId = this.tenantService.getTenantId();
    const page = await this.facebookRepo.getPageById(pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    try {
      // Check if we have any media to handle
      if (createPostDto.media && createPostDto.media.length > 0) {
        // Determine if we have photos, videos, or both
        const photos = createPostDto.media.filter(
          (m) => m.type === MediaType.IMAGE,
        );
        const videos = createPostDto.media.filter(
          (m) => m.type === MediaType.VIDEO,
        );

        // Special case: if we have only a single video, use the video API
        if (videos.length === 1 && photos.length === 0) {
          return this.handleSingleVideoPost(
            page,
            createPostDto,
            videos[0],
            tenantId,
          );
        }

        // Special case: if we have only a single photo, use the photo API
        if (photos.length === 1 && videos.length === 0) {
          return this.handleSinglePhotoPost(
            page,
            createPostDto,
            photos[0],
            tenantId,
          );
        }

        // For mixed media or multiple media items, handle as a feed post with attachments
        return this.handleMultiMediaPost(page, createPostDto, tenantId);
      }

      // If we have a link but no media, handle as a link post
      if (createPostDto.link) {
        return this.handleLinkPost(page, createPostDto, tenantId);
      }

      // Simple text post with no media or links
      return this.handleTextPost(page, createPostDto, tenantId);
    } catch (error) {
      console.error(
        'Error creating Facebook post:',
        error.response?.data || error,
      );
      throw error;
    }
  }

  /**
   * Handle a simple text post with no media
   */
  private async handleTextPost(
    page: any,
    createPostDto: CreateFacebookPagePostDto,
    tenantId: string,
  ): Promise<any> {
    const postData = await axios.post(
      `${this.baseUrl}/${this.apiVersion}/${page.pageId}/feed`,
      {
        message: createPostDto.content,
        published: createPostDto.published ?? true,
        ...(createPostDto.scheduledPublishTime && {
          scheduled_publish_time: createPostDto.scheduledPublishTime,
        }),
        ...(createPostDto.targeting && {
          targeting: this.formatTargeting(createPostDto.targeting),
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
      isPublished: createPostDto.published ?? true,
      publishedAt: createPostDto.published ? new Date() : null,
      scheduledPublishTime: !createPostDto.published
        ? createPostDto.scheduledPublishTime
        : null,
      tenantId,
    });
  }

  /**
   * Handle a link post with no media
   */
  private async handleLinkPost(
    page: any,
    createPostDto: CreateFacebookPagePostDto,
    tenantId: string,
  ): Promise<any> {
    const postData = await axios.post(
      `${this.baseUrl}/${this.apiVersion}/${page.pageId}/feed`,
      {
        message: createPostDto.content,
        link: createPostDto.link,
        published: createPostDto.published ?? true,
        ...(createPostDto.scheduledPublishTime && {
          scheduled_publish_time: createPostDto.scheduledPublishTime,
        }),
        ...(createPostDto.targeting && {
          targeting: this.formatTargeting(createPostDto.targeting),
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
      permalinkUrl: createPostDto.link,
      isPublished: createPostDto.published ?? true,
      publishedAt: createPostDto.published ? new Date() : null,
      scheduledPublishTime: !createPostDto.published
        ? createPostDto.scheduledPublishTime
        : null,
      tenantId,
    });
  }

  /**
   * Handle a single photo post
   */
  private async handleSinglePhotoPost(
    page: any,
    createPostDto: CreateFacebookPagePostDto,
    photoItem: MediaItem,
    tenantId: string,
  ): Promise<any> {
    // Upload the photo to S3 first if it's not a URL
    const mediaItem = !photoItem.url
      ? await this.mediaStorageService.uploadPostMedia(
          page.facebookAccount.id,
          [photoItem.file],
          page.id,
          SocialPlatform.FACEBOOK,
        )
      : [{ url: photoItem.url, key: photoItem.s3Key }];

    // Post to Facebook
    const photoData = await axios.post(
      `${this.baseUrl}/${this.apiVersion}/${page.pageId}/photos`,
      {
        url: mediaItem[0].url,
        message: createPostDto.content,
        published: createPostDto.published ?? true,
        ...(createPostDto.scheduledPublishTime && {
          scheduled_publish_time: createPostDto.scheduledPublishTime,
        }),
        ...(createPostDto.targeting && {
          targeting: this.formatTargeting(createPostDto.targeting),
        }),
      },
      {
        params: { access_token: page.accessToken },
      },
    );

    return this.facebookRepo.createPost({
      page,
      postId: photoData.data.post_id,
      content: createPostDto.content,
      mediaItems: [
        {
          id: photoData.data.id,
          type: MediaType.IMAGE,
          url: mediaItem[0].url,
          key: mediaItem[0].key,
        },
      ],
      isPublished: createPostDto.published ?? true,
      publishedAt: createPostDto.published ? new Date() : null,
      scheduledPublishTime: !createPostDto.published
        ? createPostDto.scheduledPublishTime
        : null,
      tenantId,
    });
  }

  /**
   * Handle a single video post
   */
  private async handleSingleVideoPost(
    page: any,
    createPostDto: CreateFacebookPagePostDto,
    videoItem: MediaItem,
    tenantId: string,
  ): Promise<any> {
    // For videos, we need to use the Resumable Upload API first to get a file handle
    let fileHandle;

    // If it's not already a URL, we need to upload it
    if (!videoItem.url) {
      // First, store in S3 for our records
      await this.mediaStorageService.uploadPostMedia(
        page.facebookAccount.id,
        [videoItem.file],
        page.id,
        SocialPlatform.FACEBOOK,
      );

      // Then, use Resumable Upload API to get a handle for Facebook
      fileHandle = await this.uploadVideoToFacebook(
        videoItem.file.buffer,
        page.accessToken,
      );
    } else {
      // If it's already a URL, we still need to download it and upload to Facebook
      const videoBuffer = await this.downloadFileFromUrl(videoItem.url);
      fileHandle = await this.uploadVideoToFacebook(
        videoBuffer,
        page.accessToken,
      );
    }

    const formData = new FormData();
    formData.append('access_token', page.accessToken);
    formData.append('description', createPostDto.content);

    if (videoItem.title) {
      formData.append('title', videoItem.title);
    }

    if (videoItem.description) {
      formData.append('description', videoItem.description);
    }

    formData.append('fbuploader_video_file_chunk', fileHandle);

    if (createPostDto.published === false) {
      formData.append('published', 'false');
      if (createPostDto.scheduledPublishTime) {
        formData.append(
          'scheduled_publish_time',
          createPostDto.scheduledPublishTime.toString(),
        );
      }
    }

    const videoPostResponse = await axios.post(
      `${this.videoUrl}/${this.apiVersion}/${page.pageId}/videos`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
      },
    );

    return this.facebookRepo.createPost({
      page,
      postId: videoPostResponse.data.id, // For videos, the post ID is the same as the video ID
      content: createPostDto.content,
      mediaItems: [
        {
          type: MediaType.VIDEO,
          url: videoItem.url ? videoItem.url : null, // Original URL if available
          key: videoItem.url ? null : videoItem.s3Key,
          id: videoPostResponse.data.id,
        },
      ],
      isPublished: createPostDto.published ?? true,
      publishedAt: createPostDto.published ? new Date() : null,
      scheduledPublishTime: !createPostDto.published
        ? createPostDto.scheduledPublishTime
        : null,
      tenantId,
    });
  }

  /**
   * Handle a post with multiple media items (photos/videos) as a feed post with attachments
   */
  private async handleMultiMediaPost(
    page: any,
    createPostDto: CreateFacebookPagePostDto,
    tenantId: string,
  ): Promise<any> {
    // First, upload all media to S3 and get media IDs from Facebook
    const mediaItems = await this.uploadFacebookMediaItems(
      createPostDto.media,
      page.id,
      'post',
    );

    // Now create a feed post with attached media
    const attachedMedia = await this.processMedia(page.accessToken, mediaItems);

    const postData = await axios.post(
      `${this.baseUrl}/${this.apiVersion}/${page.pageId}/feed`,
      {
        message: createPostDto.content,
        attached_media: attachedMedia,
        published: createPostDto.published ?? true,
        ...(createPostDto.scheduledPublishTime && {
          scheduled_publish_time: createPostDto.scheduledPublishTime,
        }),
        ...(createPostDto.targeting && {
          targeting: this.formatTargeting(createPostDto.targeting),
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
      mediaItems,
      isPublished: createPostDto.published ?? true,
      publishedAt: createPostDto.published ? new Date() : null,
      scheduledPublishTime: !createPostDto.published
        ? createPostDto.scheduledPublishTime
        : null,
      tenantId,
    });
  }

  /**
   * Upload a video to Facebook using the Resumable Upload API
   */
  private async uploadVideoToFacebook(
    videoBuffer: Buffer | string,
    accessToken: string,
  ): Promise<string> {
    const appId = config.get('platforms.facebook.clientId');

    const buffer =
      typeof videoBuffer === 'string'
        ? await this.downloadFileFromUrl(videoBuffer)
        : videoBuffer;

    // Step 1: Start an upload session
    const sessionResponse = await axios.post(
      `${this.baseUrl}/${this.apiVersion}/${appId}/uploads`,
      null,
      {
        params: {
          file_name: `video-${Date.now()}.mp4`,
          file_length: buffer.length,
          file_type: 'video/mp4',
          access_token: accessToken,
        },
      },
    );

    const uploadSessionId = sessionResponse.data.id.replace('upload:', '');

    // Step 2: Upload the file
    const uploadResponse = await axios.post(
      `${this.baseUrl}/${this.apiVersion}/upload:${uploadSessionId}`,
      buffer,
      {
        headers: {
          Authorization: `OAuth ${accessToken}`,
          file_offset: '0',
          'Content-Type': 'application/octet-stream',
        },
      },
    );

    return uploadResponse.data.h;
  }

  /**
   * Download a file from a URL and return as a Buffer
   */
  private async downloadFileFromUrl(url: string): Promise<Buffer> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }

  /**
   * Format targeting object for Facebook API
   */
  private formatTargeting(targeting: any): any {
    const formattedTargeting = { ...targeting };

    // Convert geoLocations to geo_locations if needed
    if (targeting.geoLocations) {
      formattedTargeting.geo_locations = targeting.geoLocations;
      delete formattedTargeting.geoLocations;
    }

    return formattedTargeting;
  }

  /**
   * Schedule a post on a Facebook Page
   */
  async schedulePagePost(
    pageId: string,
    createPostDto: CreateFacebookPagePostDto,
  ): Promise<any> {
    // Always ensure the post isn't published immediately
    createPostDto.published = false;

    const nowInSeconds = Math.floor(Date.now() / 1000);
    let scheduledTime: number | null = null;

    if (createPostDto.scheduledPublishTime) {
      const inputTime = createPostDto.scheduledPublishTime;

      scheduledTime =
        typeof inputTime === 'string'
          ? Math.floor(new Date(inputTime).getTime() / 1000)
          : Math.floor(inputTime.getTime() / 1000);

      const tenMinutes = 600; // in seconds
      const thirtyDays = 30 * 24 * 60 * 60; // in seconds

      if (
        scheduledTime < nowInSeconds + tenMinutes ||
        scheduledTime > nowInSeconds + thirtyDays
      ) {
        throw new BadRequestException(
          'Scheduled publish time must be between 10 minutes and 30 days from now',
        );
      }
    } else {
      throw new BadRequestException('Scheduled publish time is required');
    }

    createPostDto.scheduledPublishTime = new Date(scheduledTime * 1000);

    return this.createPagePost(pageId, createPostDto);
  }

  async getUserPages(userId: string): Promise<FacebookPage[]> {
    const tenantId = this.tenantService.getTenantId();
    // Get Facebook account details
    const account = await this.facebookRepo.getAccountById(userId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    try {
      const existingPages = await this.facebookRepo.getAccountPages(account.id);
      const response = await axios.get(
        `${this.baseUrl}/${this.apiVersion}/${account.facebookUserId}/accounts`,
        {
          params: {
            access_token: account.socialAccount.accessToken,
            fields:
              'id,name,category,access_token,category_list,tasks,about,description,followers_count',
          },
        },
      );

      // Process pages from Facebook API
      if (response.data?.data?.length > 0) {
        const fbPages = response.data.data;

        // Track pages that need to be created or updated
        const pageOperations = [];

        // Process each page from Facebook
        for (const fbPage of fbPages) {
          // Look for existing page in our database
          const existingPage = existingPages.find(
            (p) => p.pageId === fbPage.id,
          );

          // Prepare page data matching your entity schema
          const pageData = {
            pageId: fbPage.id,
            name: fbPage.name || 'Unnamed Page',
            category: fbPage.category || null,
            about: fbPage.about || null,
            description: fbPage.description || null,
            accessToken: fbPage.access_token,
            permissions: fbPage.tasks || ['CREATE_CONTENT'], // Default permission
            followerCount: fbPage.followers_count || 0,
            metadata: {
              categoryList: fbPage.category_list || [],
              lastSyncedAt: new Date().toISOString(),
            },
            tenantId,
          };

          if (existingPage) {
            // Update existing page
            pageOperations.push(
              this.facebookRepo.updatePage(existingPage.id, pageData),
            );
          } else {
            pageData['facebookAccount'] = account;
            pageOperations.push(this.facebookRepo.createPage(pageData));
          }
        }

        // Wait for all page operations to complete
        await Promise.all(pageOperations);
      } else {
        this.logger.error('No pages returned from Facebook API');
      }

      // Fetch and return the updated list of pages
      return await this.facebookRepo.getAccountPages(account.id);
    } catch (error) {
      this.logger.error(
        'Error fetching or processing Facebook pages:',
        error.response?.data || error.message,
      );
      throw new Error(`Failed to fetch Facebook pages: ${error.message}`);
    }
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

  async getPageInsights(
    pageId: string,
    period: string = 'days_28',
    customMetrics?: string,
  ): Promise<any> {
    // Validate the period parameter
    const validPeriods = ['day', 'week', 'days_28'];
    if (!validPeriods.includes(period)) {
      throw new BadRequestException(
        `Invalid period. Must be one of: ${validPeriods.join(', ')}`,
      );
    }

    const page = await this.facebookRepo.getPageById(pageId);
    if (!page || !page.accessToken) {
      throw new NotFoundException('Page not found or missing access token');
    }

    // Define metrics based on the latest Facebook documentation
    const metrics = customMetrics
      ? customMetrics.split(',')
      : [
          'page_impressions', // The number of times any Page content entered a person's screen
          'page_post_engagements', // Engagement with Page posts
          'page_fan_adds_unique', // New Page likes (unique accounts)
          'page_views_total', // Total Page views
          'page_daily_follows_unique', // New followers (unique accounts)
          'page_posts_impressions_unique', // Unique users who saw your Page's posts
          'page_actions_post_reactions_total', // Total reactions on Page posts
        ];

    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.apiVersion}/${page.pageId}/insights`,
        {
          params: {
            access_token: page.accessToken,
            metric: metrics.join(','),
            period: period,
          },
        },
      );
      return this.transformPageMetrics(response.data.data, period);
    } catch (error) {
      this.logger.error(
        'Error fetching page insights:',
        error.response?.data || error.message,
      );

      // Check for specific error codes from Facebook docs
      if (error.response?.data?.error) {
        const fbError = error.response.data.error;

        if (fbError.code === 80001) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else if (fbError.code === 190) {
          throw new Error(
            'Invalid access token. The page token may have expired.',
          );
        } else if (fbError.code === 100) {
          throw new Error(`Invalid parameter: ${fbError.message}`);
        }
      }

      throw new Error(`Failed to fetch page insights: ${error.message}`);
    }
  }

  private transformPageMetrics(
    data: any[],
    period: string,
  ): PageInsightsResult {
    // Create a more structured response with metric descriptions and values
    const result: PageInsightsResult = {
      period: period,
      collected_at: new Date().toISOString(),
      metrics: {},
      summary: {
        impressions: 0,
        engagement: 0,
        new_likes: 0,
        page_views: 0,
        new_followers: 0,
      },
    };

    // Process each metric
    data.forEach((metric) => {
      const metricName = metric.name;
      const values = metric.values || [];

      // Store current value, trend, and description
      result.metrics[metricName] = {
        name: this.getMetricDisplayName(metricName),
        description: this.getMetricDescription(metricName),
        current_value: values[0]?.value || 0,
        previous_value: values[1]?.value || 0,
        trend_percentage: values[1]?.value
          ? Math.round(
              (((values[0]?.value || 0) - values[1]?.value) /
                values[1]?.value) *
                100,
            )
          : 0,
        values: values.map((v) => ({
          end_time: v.end_time,
          value: v.value,
        })),
      };
    });

    // Add summary metrics for quick access
    result.summary = {
      impressions: this.getSafeMetricValue(result.metrics, 'page_impressions'),
      engagement: this.getSafeMetricValue(
        result.metrics,
        'page_post_engagements',
      ),
      new_likes: this.getSafeMetricValue(
        result.metrics,
        'page_fan_adds_unique',
      ),
      page_views: this.getSafeMetricValue(result.metrics, 'page_views_total'),
      new_followers: this.getSafeMetricValue(
        result.metrics,
        'page_daily_follows_unique',
      ),
    };

    return result;
  }

  private getSafeMetricValue(metrics: any, key: string): number {
    return metrics[key]?.current_value || 0;
  }

  private getMetricDisplayName(metricName: string): string {
    const displayNames = {
      page_impressions: 'Page Impressions',
      page_post_engagements: 'Post Engagements',
      page_fan_adds_unique: 'New Page Likes',
      page_views_total: 'Page Views',
      page_daily_follows_unique: 'New Followers',
      page_engaged_users: 'Engaged Users',
      page_posts_impressions_unique: 'Post Reach',
      page_actions_post_reactions_total: 'Post Reactions',
      // Add more mappings as needed
    };

    return displayNames[metricName] || metricName;
  }

  private getMetricDescription(metricName: string): string {
    const descriptions = {
      page_impressions:
        "The number of times any content from your Page entered a person's screen",
      page_post_engagements:
        'The number of times people engaged with your posts through likes, comments, shares and more',
      page_fan_adds_unique: 'The number of new people who liked your Page',
      page_views_total: 'The number of times your Page profile was viewed',
      page_daily_follows_unique: 'The number of new followers of your Page',
      page_engaged_users: 'The number of people who engaged with your Page',
      page_posts_impressions_unique:
        'The number of people who saw your Page posts',
      page_actions_post_reactions_total:
        'The number of reactions on your posts',
      // Add more descriptions as needed
    };

    return descriptions[metricName] || 'No description available';
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
      throw new BadRequestException('Failed to fetch Facebook metrics', error);
    }
  }

  async getPageMetrics(
    pageId: string,
    dateRange: DateRange,
  ): Promise<AccountMetrics> {
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
          ? await this.processMedia(post.page.accessToken, mediaItems)
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
    const post = await this.facebookRepo.getPostById(postId);
    await axios.delete(`${this.baseUrl}/${this.apiVersion}/${post.postId}`, {
      params: { access_token: post.page.accessToken },
    });
    await this.facebookRepo.deletePost(postId);
  }

  /**
   * Process media items to get Facebook media IDs for attachment
   * This method uploads each media URL to Facebook to get a media_fbid
   */
  private async processMedia(
    accessToken: string,
    mediaItems: MediaStorageItem[],
  ): Promise<Array<{ media_fbid: string }>> {
    const mediaPromises = mediaItems.map(async (item) => {
      try {
        // Different handling based on media type
        if (
          item.type === MediaType.PHOTO ||
          (item.mimeType && item.mimeType.startsWith('image/'))
        ) {
          // For photos, use the photos endpoint
          const uploadResponse = await axios.post(
            `${this.baseUrl}/me/photos`,
            {
              url: item.url,
              published: false, // Important: Don't publish as a separate post
              temporary: true, // Mark as temporary for attachment purpose
            },
            {
              params: {
                access_token: accessToken,
              },
            },
          );

          this.logger.debug('Successfully got photo fbid', {
            id: uploadResponse.data.id,
          });
          return { media_fbid: uploadResponse.data.id };
        } else if (
          item.type === MediaType.VIDEO ||
          (item.mimeType && item.mimeType.startsWith('video/'))
        ) {
          // For videos, we need to handle differently
          // Since videos can't use the simple URL upload like photos
          const videoBuffer = await this.downloadFileFromUrl(item.url);
          const fileHandle = await this.uploadVideoToFacebook(
            videoBuffer,
            accessToken,
          );

          // Upload the video but don't publish it
          const formData = new FormData();
          formData.append('access_token', accessToken);
          formData.append('published', 'false');
          formData.append('temporary', 'true');
          formData.append('fbuploader_video_file_chunk', fileHandle);

          const videoResponse = await axios.post(
            `${this.videoUrl}/${this.apiVersion}/me/videos`,
            formData,
            {
              headers: {
                ...formData.getHeaders(),
              },
            },
          );

          this.logger.debug('Successfully got video fbid', {
            id: videoResponse.data.id,
          });
          return { media_fbid: videoResponse.data.id };
        } else {
          throw new Error(`Unsupported media type: ${item.type}`);
        }
      } catch (error) {
        this.logger.error('Failed to process media item', {
          url: item.url,
          error: error.response?.data || error.message,
        });

        // Re-throw with more context
        throw new Error(
          `Failed to process media: ${error.response?.data?.error?.message || error.message}`,
        );
      }
    });

    return Promise.all(mediaPromises);
  }
}
