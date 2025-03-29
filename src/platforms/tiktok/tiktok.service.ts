import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import axios from 'axios';
import * as config from 'config';
import { TikTokApiException } from './helpers/tiktok-api.exception';
import {
  CommentResponse,
  MediaItem,
  PlatformService,
  PostResponse,
  SocialAccountDetails,
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
import { TenantService } from '../../user-management/tenant/tenant.service';
import { MediaStorageService } from '../../asset-management/media-storage/media-storage.service';
import { MediaStorageItem } from '../../asset-management/media-storage/media-storage.dto';

@Injectable()
export class TikTokService implements PlatformService {
  private readonly baseUrl: string;
  private readonly logger = new Logger(TikTokService.name);

  constructor(
    private readonly tiktokRepo: TikTokRepository,
    private readonly tiktokConfig: TikTokConfig,
    private readonly tenantService: TenantService,
    private readonly mediaStorageService: MediaStorageService,
  ) {
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
      const tenantId = this.tenantService.getTenantId();
      this.tiktokRepo.setTenantId(tenantId);
      return await this.tiktokRepo.getAccountById(userId);
    } catch (error) {
      this.logger.error(
        `Failed to fetch Facebook accounts for user ${userId}`,
        error.stack,
      );
    }
  }

  async getUserAccounts(userId: string): Promise<SocialAccountDetails[]> {
    const tenantId = this.tenantService.getTenantId();
    this.tiktokRepo.setTenantId(tenantId);
    const account = await this.tiktokRepo.getAccountById(userId);
    if (!account) {
      throw new NotFoundException('No Tiktok accounts found for user');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/user/info/`, {
        headers: {
          Authorization: `Bearer ${account.socialAccount.accessToken}`,
        },
      });

      return [
        {
          id: response.data.data.user.open_id,
          name: response.data.data.user.display_name,
          type: 'creator',
          avatarUrl: response.data.data.user.avatar_url,
          platformSpecific: {
            bio: response.data.data.user.bio_description,
            isVerified: response.data.data.user.verified,
          },
        },
      ];
    } catch (error) {
      throw new TikTokApiException('Failed to fetch user account', error);
    }
  }

  async getComments(
    accountId: string,
    videoId: string,
    pageToken?: string,
  ): Promise<CommentResponse> {
    try {
      const tenantId = this.tenantService.getTenantId();
      this.tiktokRepo.setTenantId(tenantId);
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
      const tenantId = this.tenantService.getTenantId();
      this.tiktokRepo.setTenantId(tenantId);

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

  private async getUserInfo(accessToken: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/user/info/`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          fields: [
            'open_id',
            'union_id',
            'avatar_url',
            'display_name',
            'bio_description',
          ],
        },
      });

      return response.data.data;
    } catch (error) {
      throw new TikTokApiException('Failed to fetch user info', error);
    }
  }

  async initializeVideoUpload(
    accountId: string,
    params: CreateVideoParams,
    uploadInfo: VideoUploadInit,
  ): Promise<VideoUploadResponse> {
    const tenantId = this.tenantService.getTenantId();
    this.tiktokRepo.setTenantId(tenantId);

    const account = await this.tiktokRepo.getById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    try {
      const response = await axios.post(
        `${this.baseUrl}/post/publish/video/init/`,
        {
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
        },
        {
          headers: {
            Authorization: `Bearer ${account.socialAccount.accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
        },
      );

      if (response.data.error.code !== 'ok') {
        throw new TikTokApiException(response.data.error.message);
      }

      // Store video record
      await this.tiktokRepo.createVideo({
        account,
        publishId: response.data.data.publish_id,
        uploadUrl: response.data.data.upload_url,
        status: params.status.toString(),
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
        publishId: response.data.data.publish_id,
        uploadUrl: response.data.data.upload_url,
      };
    } catch (error) {
      throw new TikTokApiException('Failed to initialize video upload', error);
    }
  }

  async initializeFileUpload(
    accountId: string,
    videoSize: number,
    chunkSize: number,
  ): Promise<any> {
    const tenantId = this.tenantService.getTenantId();
    this.tiktokRepo.setTenantId(tenantId);

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
    const tenantId = this.tenantService.getTenantId();
    this.tiktokRepo.setTenantId(tenantId);

    const account = await this.tiktokRepo.getById(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Store media in S3 first if there are any media items
    const mediaItems = await this.uploadTitTokMediaItemsToStorage(
      media,
      account.tiktokUserId,
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

  async uploadLocalVideo(
    accountId: string,
    videoBuffer: Buffer,
    params: CreateVideoParams,
  ): Promise<PostResponse> {
    const tenantId = this.tenantService.getTenantId();
    this.tiktokRepo.setTenantId(tenantId);

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
    const tenantId = this.tenantService.getTenantId();
    this.tiktokRepo.setTenantId(tenantId);

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
    const tenantId = this.tenantService.getTenantId();
    this.tiktokRepo.setTenantId(tenantId);

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
      const tenantId = this.tenantService.getTenantId();
      this.tiktokRepo.setTenantId(tenantId);

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
    const tenantId = this.tenantService.getTenantId();
    this.tiktokRepo.setTenantId(tenantId);

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
    const tenantId = this.tenantService.getTenantId();
    this.tiktokRepo.setTenantId(tenantId);

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
    const tenantId = this.tenantService.getTenantId();
    this.tiktokRepo.setTenantId(tenantId);

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
    const tenantId = this.tenantService.getTenantId();
    this.tiktokRepo.setTenantId(tenantId);

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
}
