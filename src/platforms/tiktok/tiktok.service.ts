import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import * as config from 'config';
import { TikTokApiException } from './helpers/tiktok-api.exception';
import {
  CommentResponse,
  MediaItem,
  PlatformService,
  PostResponse,
} from '../platform-service.interface';
import { TikTokRepository } from './repositories/tiktok.repository';
import {
  CreateVideoParams,
  TikTokPostVideoStatus,
  VideoUploadInit,
  VideoUploadResponse,
} from './helpers/tiktok.interfaces';
import { TikTokConfig } from './config/tiktok.config';
import {
  AccountMetrics,
  DateRange,
  PostMetrics,
} from '../../cross-platform/helpers/cross-platform.interface';
import { TikTokAccount } from '../entities/tiktok-entities/tiktok-account.entity';
import { MediaStorageService } from '../../asset-management/media-storage/media-storage.service';
import { MediaStorageItem } from '../../asset-management/media-storage/media-storage.dto';
import { PinoLogger } from 'nestjs-pino';
import { TenantService } from '../../user-management/tenant.service';

@Injectable()
export class TikTokService implements PlatformService {
  private readonly baseUrl: string = config.get('platforms.tiktok.baseUrl');

  constructor(
    private readonly tiktokRepo: TikTokRepository,
    private readonly tiktokConfig: TikTokConfig,
    private readonly tenantService: TenantService,
    private readonly mediaStorageService: MediaStorageService,

    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(TikTokService.name);
    this.baseUrl = tiktokConfig.baseUrl;
  }

  private async uploadTitTokMediaItemsToStorage(
    media: MediaItem[],
    titkotAccountId: string,
    context: 'post' | 'scheduled',
  ): Promise<MediaStorageItem[]> {
    const mediaItems: MediaStorageItem[] = [];

    if (!media?.length) {
      return mediaItems;
    }

    for (const mediaItem of media) {
      const timestamp = Date.now();
      const prefix = `tiktok-${context}-${timestamp}`;

      if (mediaItem.file) {
        // For uploaded files
        const uploadedMedia = await this.mediaStorageService.uploadPostMedia(
          titkotAccountId,
          [mediaItem.file],
          prefix,
        );
        mediaItems.push(...uploadedMedia);
      } else if (mediaItem.url) {
        // For media URLs
        const uploadedMedia = await this.mediaStorageService.uploadMediaFromUrl(
          titkotAccountId,
          mediaItem.url,
          prefix,
        );
        mediaItems.push(uploadedMedia);
      }
    }

    return mediaItems;
  }

  async getAccountsByUserId(userId: string): Promise<TikTokAccount> {
    try {
      return await this.tiktokRepo.getAccountById(userId);
    } catch (error) {
      this.logger.error(
        `Failed to fetch Facebook accounts for user ${userId}`,
        error.stack,
      );
    }
  }

  async getUserAccounts(userId: string): Promise<TikTokAccount> {
    const account = await this.tiktokRepo.getAccountById(userId);
    if (!account) {
      throw new NotFoundException('No Tiktok accounts found for user');
    }
    return account;
  }

  async getComments(
    accountId: string,
    videoId: string,
    pageToken?: string,
  ): Promise<CommentResponse> {
    try {
      const account = await this.tiktokRepo.getById(accountId);
      if (!account) {
        throw new NotFoundException('Account not found');
      }

      const response = await axios.get(`${this.baseUrl}/video/comment/list/`, {
        headers: {
          Authorization: `Bearer ${account.socialAccount.accessToken}`,
        },
        params: {
          video_id: videoId,
          cursor: pageToken,
          max_count: 50,
          fields: [
            'id',
            'text',
            'create_time',
            'user_id',
            'username',
            'likes_count',
            'reply_count',
          ],
        },
      });

      const comments = await Promise.all(
        response.data.data.comments.map(async (comment: any) => {
          return await this.tiktokRepo.createComment({
            videoId,
            platformCommentId: comment.id,
            content: comment.text,
            authorId: comment.user_id,
            authorUsername: comment.username,
            likeCount: comment.likes_count,
            replyCount: comment.reply_count,
            commentedAt: new Date(comment.create_time * 1000),
          });
        }),
      );

      return {
        items: comments,
        nextPageToken: response.data.data.cursor,
      };
    } catch (error) {
      throw new TikTokApiException('Failed to fetch TikTok comments', error);
    }
  }

  async getPostMetrics(
    accountId: string,
    videoId: string,
  ): Promise<PostMetrics> {
    try {
      const account = await this.tiktokRepo.getById(accountId);
      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      const response = await axios.post(
        `${this.baseUrl}/video/query/`,
        {
          filters: {
            video_ids: [videoId],
          },
        },
        {
          params: {
            fields: [
              'id',
              'like_count',
              'comment_count',
              'share_count',
              'view_count',
              'play_count',
              'forward_count',
              'download_count',
            ].join(','),
          },
          headers: {
            Authorization: `Bearer ${account.socialAccount.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data.error.code !== 'ok') {
        throw new TikTokApiException(response.data.error.message);
      }

      const video = response.data.data.videos[0];

      return {
        engagement:
          video.like_count + video.comment_count + video.share_count || 0,
        impressions: video.view_count || 0,
        reactions: video.like_count || 0,
        comments: video.comment_count || 0,
        shares: video.share_count || 0,
        platformSpecific: {
          playCount: video.play_count || video.view_count || 0,
          forwardCount: video.forward_count || 0,
          downloadCount: video.download_count || 0,
          avgWatchTime: video.average_watch_time || 0,
          completionRate: video.video_completion_rate || 0,
        },
      };
    } catch (error) {
      throw new TikTokApiException('Failed to fetch video metrics', error);
    }
  }

  async initializeVideoUpload(
    accountId: string,
    params: CreateVideoParams,
    uploadInfo: VideoUploadInit,
  ): Promise<VideoUploadResponse> {
    let account = await this.tiktokRepo.getById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    try {
      // Make sure the access token is valid
      if (!account.socialAccount?.accessToken) {
        throw new Error('Access token not available for account');
      }

      // This is important as TikTok access tokens expire
      if (account.socialAccount.refreshToken) {
        try {
          const refreshedAccount = await this.refreshAccessToken(account);
          if (refreshedAccount) {
            account = refreshedAccount;
          }
        } catch (refreshError) {
          console.warn('Failed to refresh token:', refreshError);
        }
      }

      const requestBody = {
        post_info: {
          title: params.title,
          privacy_level: params.privacyLevel,
          disable_duet: params.disableDuet,
          disable_stitch: params.disableStitch,
          disable_comment: params.disableComment,
          video_cover_timestamp_ms: params.videoCoverTimestampMs,
          brand_content_toggle: params.brandContentToggle,
          brand_organic_toggle: params.brandOrganicToggle,
          is_aigc: params.isAigc,
        },
        source_info: {
          source: uploadInfo.source,
          ...(uploadInfo.source === 'PULL_FROM_URL' && {
            video_url: uploadInfo.videoUrl,
          }),
          ...(uploadInfo.source === 'FILE_UPLOAD' && {
            video_size: uploadInfo.videoSize,
            chunk_size: uploadInfo.chunkSize,
            total_chunk_count: uploadInfo.totalChunkCount,
          }),
        },
      };

      const response = await axios.post(
        `${this.baseUrl}/post/publish/video/init/`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${account.socialAccount.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data.error && response.data.error.code !== 'ok') {
        throw new TikTokApiException(
          response.data.error.message || 'Unknown TikTok API error',
          response.data.error,
        );
      }

      if (!response.data.data || !response.data.data.publish_id) {
        throw new TikTokApiException(
          'Invalid response from TikTok API: Missing publish_id',
          response.data,
        );
      }

      const uploadUrl = response.data.data.upload_url || null;
      const publishId = response.data.data.publish_id;

      // Store video record
      await this.tiktokRepo.createVideo({
        account,
        tenantId: this.tenantService.getTenantId(),
        publishId: publishId,
        uploadUrl: uploadUrl,
        status: params.status,
        privacyLevel: params.privacyLevel,
        title: params.title,
        disableDuet: params.disableDuet,
        disableStitch: params.disableStitch,
        disableComment: params.disableComment,
        videoCoverTimestampMs: params.videoCoverTimestampMs,
        brandContentToggle: params.brandContentToggle,
        brandOrganicToggle: params.brandOrganicToggle,
        isAigc: params.isAigc,
      });

      return {
        publishId: publishId,
        uploadUrl: uploadUrl,
      };
    } catch (error) {
      console.error('TikTok video initialization error:', error);

      // More informative error handling
      if (axios.isAxiosError(error)) {
        const responseData = error.response?.data;
        throw new TikTokApiException(
          `Failed to initialize video upload: ${responseData?.message || error.message}`,
          responseData || error,
        );
      }

      throw new TikTokApiException('Failed to initialize video upload', error);
    }
  }

  async initializeFileUpload(
    accountId: string,
    videoSize: number,
    chunkSize: number,
  ): Promise<any> {
    const account = await this.tiktokRepo.getById(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    try {
      const totalChunkCount = Math.ceil(videoSize / chunkSize);

      const response = await axios.post(
        `${this.baseUrl}/post/publish/inbox/video/init/`,
        {
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: videoSize,
            chunk_size: chunkSize,
            total_chunk_count: totalChunkCount,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${account.socialAccount.accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
        },
      );

      if (response.data.error.code !== 'ok') {
        throw new TikTokApiException(
          response.data.error.message,
          response.data.error.code,
        );
      }

      // Store upload session
      const session = await this.tiktokRepo.createUploadSession({
        accountId,
        publishId: response.data.data.publish_id,
        uploadUrl: response.data.data.upload_url,
        uploadParams: response.data.data,
        status: TikTokPostVideoStatus.PENDING,
        expiresAt: new Date(Date.now() + 7200000), // 2 hours
      });

      return session;
    } catch (error) {
      throw new TikTokApiException('Failed to initialize file upload', error);
    }
  }

  async post(
    accountId: string,
    params: CreateVideoParams,
    media: MediaItem[],
  ): Promise<PostResponse> {
    const account = await this.tiktokRepo.getById(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Store media in S3 first if there are any media items
    const mediaItems = await this.uploadTitTokMediaItemsToStorage(
      media,
      account.openId,
      'post',
    );

    try {
      // First initialize the upload
      const uploadResponse = await this.initializeVideoUpload(
        accountId,
        params,
        {
          source: 'PULL_FROM_URL',
          videoUrl: mediaItems[0].url,
        },
      );
      if (uploadResponse.publishId.startsWith('v_pub_url~v2')) {
        const status = await this.checkPublishStatus(
          accountId,
          uploadResponse.publishId,
        );

        if (status === 'FAILED') {
          throw new TikTokApiException('Video publishing failed');
        }
      } else {
        // Fall back to the traditional upload status check
        const status = await this.checkUploadStatus(
          accountId,
          uploadResponse.publishId,
        );

        if (status === 'FAILED') {
          throw new TikTokApiException('Video upload failed');
        }
      }

      return {
        platformPostId: uploadResponse.publishId,
        postedAt: new Date(),
      };
    } catch (error) {
      console.error('TikTok post error:', error);
      throw new TikTokApiException('Failed to upload video', error);
    }
  }

  async checkPublishStatus(
    accountId: string,
    publishId: string,
    maxRetries = 10,
    delayMs = 3000,
  ): Promise<'PUBLISHED' | 'PUBLISHING' | 'FAILED'> {
    const account = await this.tiktokRepo.getById(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    let retries = 0;

    while (retries < maxRetries) {
      try {
        this.logger.info(
          `Checking publish status for ${publishId} (Attempt ${retries + 1}/${maxRetries})`,
        );

        const response = await axios.get(
          `${this.baseUrl}/post/publish/status/query/`,
          {
            params: { publish_id: publishId },
            headers: {
              Authorization: `Bearer ${account.socialAccount.accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        );

        // Check for TikTok API error
        if (response.data.error && response.data.error.code !== 'ok') {
          console.error(
            'TikTok API error when checking publish status:',
            response.data.error,
          );
          throw new TikTokApiException(
            `Failed to check publish status: ${response.data.error.message}`,
            response.data.error,
          );
        }

        // Check the publish status
        const status = response.data.data?.publish_status;

        if (!status) {
          console.warn('No publish status returned from TikTok API');
          // Wait and retry
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          retries++;
          continue;
        }

        // Map TikTok API status to our status enum
        switch (status.toLowerCase()) {
          case 'publish_success':
          case 'success':
          case 'published':
            return 'PUBLISHED';
          case 'publish_failed':
          case 'failed':
            console.error(
              'Publish failed with reason:',
              response.data.data?.fail_reason || 'Unknown reason',
            );
            return 'FAILED';
          case 'publish_processing':
          case 'processing':
          case 'publishing':
          default:
            // Still processing, wait and retry
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            retries++;
            continue;
        }
      } catch (error) {
        // If we get a 404, the endpoint might be incorrect - try an alternative endpoint
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          try {
            // Try alternative endpoint
            const altResponse = await axios.get(
              `${this.baseUrl}/post/publish/status/fetch/`,
              {
                params: { publish_id: publishId },
                headers: {
                  Authorization: `Bearer ${account.socialAccount.accessToken}`,
                  'Content-Type': 'application/json',
                },
              },
            );
            // Process the response similar to above...
            if (
              altResponse.data.error &&
              altResponse.data.error.code !== 'ok'
            ) {
              throw new TikTokApiException(
                `Failed to check publish status: ${altResponse.data.error.message}`,
                altResponse.data.error,
              );
            }

            const altStatus = altResponse.data.data?.publish_status;

            if (!altStatus) {
              await new Promise((resolve) => setTimeout(resolve, delayMs));
              retries++;
              continue;
            }

            switch (altStatus.toLowerCase()) {
              case 'publish_success':
              case 'success':
              case 'published':
                return 'PUBLISHED';
              case 'publish_failed':
              case 'failed':
                return 'FAILED';
              default:
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                retries++;
                continue;
            }
          } catch (altError) {
            console.error('Alternative endpoint also failed:', altError);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            retries++;
            continue;
          }
        }

        // For other errors, wait and retry
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        retries++;
      }
    }

    // If we've exhausted all retries, assume it's still processing
    // TikTok may take a while to process videos
    this.logger.warn(
      `Exhausted ${maxRetries} retries checking publish status, returning PUBLISHING`,
    );
    return 'PUBLISHING';
  }

  async uploadLocalVideo(
    accountId: string,
    videoBuffer: Buffer,
    params: CreateVideoParams,
  ): Promise<PostResponse> {
    const account = await this.tiktokRepo.getById(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    try {
      const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
      const totalChunks = Math.ceil(videoBuffer.length / CHUNK_SIZE);

      // Initialize upload
      const uploadResponse = await this.initializeVideoUpload(
        accountId,
        params,
        {
          source: 'FILE_UPLOAD',
          videoSize: videoBuffer.length,
          chunkSize: CHUNK_SIZE,
          totalChunkCount: totalChunks,
        },
      );

      if (!uploadResponse.uploadUrl) {
        throw new TikTokApiException('No upload URL provided');
      }

      // Upload chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, videoBuffer.length);
        const chunk = videoBuffer.slice(start, end);

        await this.uploadChunk(
          uploadResponse.uploadUrl,
          chunk,
          i,
          start,
          end - 1,
          videoBuffer.length,
        );
      }

      // Monitor upload status
      const status = await this.checkUploadStatus(
        accountId,
        uploadResponse.publishId,
      );
      if (status === 'FAILED') {
        throw new TikTokApiException('Video upload failed');
      }

      return {
        platformPostId: uploadResponse.publishId,
        postedAt: new Date(),
      };
    } catch (error) {
      throw new TikTokApiException('Failed to upload video', error);
    }
  }

  private async uploadChunk(
    uploadUrl: string,
    chunk: Buffer,
    chunkIndex: number,
    start: number,
    end: number,
    totalSize: number,
  ): Promise<void> {
    try {
      await axios.put(uploadUrl, chunk, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Content-Length': chunk.length.toString(),
        },
      });
    } catch (error) {
      throw new TikTokApiException(
        `Failed to upload chunk ${chunkIndex}`,
        error,
      );
    }
  }

  async checkUploadStatus(
    accountId: string,
    publishId: string,
  ): Promise<string> {
    const account = await this.tiktokRepo.getById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    try {
      const response = await axios.get(
        `${this.baseUrl}/post/publish/status/fetch/`,
        {
          params: {
            publish_id: publishId,
          },
          headers: {
            Authorization: `Bearer ${account.socialAccount.accessToken}`,
          },
        },
      );

      if (response.data.error.code !== 'ok') {
        throw new TikTokApiException(response.data.error.message);
      }

      // Update status in database
      await this.tiktokRepo.updateVideoStatus(
        publishId,
        response.data.data.status,
      );

      return response.data.data.status;
    } catch (error) {
      throw new TikTokApiException('Failed to check upload status', error);
    }
  }

  async getVideoStatus(accountId: string, publishId: string): Promise<any> {
    const account = await this.tiktokRepo.getById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    try {
      const response = await axios.get(
        `${this.baseUrl}/post/publish/status/fetch/`,
        {
          params: {
            publish_id: publishId,
          },
          headers: {
            Authorization: `Bearer ${account.socialAccount.accessToken}`,
          },
        },
      );

      if (response.data.error.code !== 'ok') {
        throw new TikTokApiException(response.data.error.message);
      }

      return response.data.data;
    } catch (error) {
      throw new TikTokApiException('Failed to get video status', error);
    }
  }

  async uploadVideoChunks(
    sessionId: string,
    videoBuffer: Buffer,
    chunkSize: number,
  ): Promise<void> {
    const session = await this.tiktokRepo.getUploadSession(sessionId);
    if (!session) {
      throw new NotFoundException('Upload session not found');
    }

    try {
      const chunks = this.splitBuffer(videoBuffer, chunkSize);

      for (let i = 0; i < chunks.length; i++) {
        await axios.put(session.uploadUrl, chunks[i], {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Range': `bytes ${i * chunkSize}-${(i + 1) * chunkSize - 1}/${videoBuffer.length}`,
          },
        });
      }
      await this.tiktokRepo.updateUploadSession(sessionId, 'COMPLETED');
    } catch (error) {
      await this.tiktokRepo.updateUploadSession(sessionId, 'FAILED');
      throw new TikTokApiException('Failed to upload video chunks', error);
    }
  }

  private splitBuffer(buffer: Buffer, chunkSize: number): Buffer[] {
    const chunks: Buffer[] = [];
    for (let i = 0; i < buffer.length; i += chunkSize) {
      chunks.push(buffer.slice(i, i + chunkSize));
    }
    return chunks;
  }

  async getAccountAnalytics(accountId: string): Promise<any> {
    const account = await this.tiktokRepo.getById(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/research/user/info/`, {
        headers: {
          Authorization: `Bearer ${account.socialAccount.accessToken}`,
        },
        params: {
          fields: [
            'followers_count',
            'following_count',
            'likes_count',
            'video_count',
            'profile_views',
            'engagement_rate',
          ],
        },
      });

      return response.data.data;
    } catch (error) {
      throw new TikTokApiException('Failed to fetch account analytics', error);
    }
  }

  async getVideoPerformance(
    accountId: string,
    videoId: string,
    days: number = 7,
  ): Promise<any> {
    const account = await this.tiktokRepo.getById(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/research/video/query/`,
        {
          headers: {
            Authorization: `Bearer ${account.socialAccount.accessToken}`,
          },
          params: {
            fields: [
              'video_views',
              'total_play',
              'total_share',
              'average_watch_time',
              'play_duration',
              'reach',
              'engagement',
              'video_retention',
            ],
            filters: {
              video_ids: [videoId],
              date_range: {
                start_date: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split('T')[0],
                end_date: new Date().toISOString().split('T')[0],
              },
            },
          },
        },
      );

      return response.data.data;
    } catch (error) {
      throw new TikTokApiException('Failed to fetch video performance', error);
    }
  }

  async getAccountMetrics(
    accountId: string,
    dateRange: DateRange,
  ): Promise<AccountMetrics> {
    const account = await this.tiktokRepo.getById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    try {
      const response = await axios.get(`${this.baseUrl}/user/stats/`, {
        headers: {
          Authorization: `Bearer ${account.socialAccount.accessToken}`,
        },
        params: {
          fields: [
            'follower_count',
            'following_count',
            'likes_count',
            'video_count',
            'profile_views',
            'comment_count',
            'share_count',
          ].join(','),
          start_date: dateRange.startDate,
          end_date: dateRange.endDate,
        },
      });

      return {
        followers: response.data.data.follower_count || 0,
        engagement:
          (response.data.data.likes_count || 0) +
          (response.data.data.comment_count || 0),
        impressions: response.data.data.profile_views || 0,
        reach: response.data.data.profile_views || 0, // TikTok doesn't provide specific reach metrics
        posts: response.data.data.video_count || 0,
        platformSpecific: {
          followingCount: response.data.data.following_count,
          likesCount: response.data.data.likes_count,
          commentCount: response.data.data.comment_count,
          shareCount: response.data.data.share_count,
        },
        dateRange,
      };
    } catch (error) {
      throw new TikTokApiException('Failed to fetch account metrics', error);
    }
  }

  private async downloadVideo(url: string): Promise<Buffer> {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
    });
    return Buffer.from(response.data, 'binary');
  }

  async revokeAccess(accountId: string): Promise<void> {
    const account = await this.tiktokRepo.getById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    try {
      await axios.post(`${this.baseUrl}/oauth/revoke/`, null, {
        params: {
          client_key: config.get('platforms.tiktok.clientKey'),
          client_secret: config.get('platforms.tiktok.clientSecret'),
          token: account.socialAccount.accessToken,
        },
      });

      await this.tiktokRepo.deleteAccount(accountId);
    } catch (error) {
      throw new TikTokApiException('Failed to revoke TikTok access', error);
    }
  }

  async refreshAccessToken(
    account: TikTokAccount,
  ): Promise<TikTokAccount | null> {
    if (!account.socialAccount.refreshToken) {
      return null;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/oauth/refresh_token/`,
        {
          client_key: config.get('platforms.tiktok.clientKey'),
          client_secret: config.get('platforms.tiktok.clientSecret'),
          grant_type: 'refresh_token',
          refresh_token: account.socialAccount.refreshToken,
        },
      );

      if (response.data && response.data.access_token) {
        // Update the account with the new tokens
        account.socialAccount.accessToken = response.data.access_token;
        if (response.data.refresh_token) {
          account.socialAccount.refreshToken = response.data.refresh_token;
        }

        // Save the updated account
        return await this.tiktokRepo.updateAccount(account);
      }

      return null;
    } catch (error) {
      console.error('Failed to refresh TikTok access token:', error);
      return null;
    }
  }
}
