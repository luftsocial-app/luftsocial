import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { TikTokApiException } from './helpers/tiktok-api.exception';
import {
  CommentResponse,
  PlatformService,
  PostResponse,
  TokenResponse,
} from '../platform-service.interface';
import { TikTokRepository } from './repositories/tiktok.repository';
import {
  CreateVideoParams,
  TikTokPostVideoStatus,
  TIktokTokenResponse,
  VideoMetrics,
  VideoUploadInit,
  VideoUploadResponse,
} from './helpers/tiktok.interfaces';
import { TikTokConfig } from './config/tiktok.config';

@Injectable()
export class TikTokService implements PlatformService {
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly tiktokRepo: TikTokRepository,
    private readonly tiktokConfig: TikTokConfig,
  ) {
    this.baseUrl = tiktokConfig.baseUrl;
  }

  async authorize(userId: string): Promise<string> {
    const state = await this.tiktokRepo.createAuthState(userId);
    return this.tiktokConfig.getAuthUrl(state);
  }

  async handleCallback(code: string): Promise<TIktokTokenResponse> {
    try {
      const tokenResponse = await this.exchangeCodeForToken(code);
      const userInfo = await this.getUserInfo(tokenResponse.access_token);

      return {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresIn: tokenResponse.expires_in,
        tokenType: 'Bearer',
        scope: tokenResponse.scope.split(','),
        metadata: {
          userInfo,
        },
      };
    } catch (error) {
      throw new TikTokApiException('Failed to handle TikTok callback', error);
    }
  }

  async refreshToken(accountId: string): Promise<TokenResponse> {
    const account = await this.tiktokRepo.getById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    try {
      const response = await axios.post(
        `${this.baseUrl}/oauth2/token`,
        {
          grant_type: 'refresh_token',
          refresh_token: account.socialAccount.refreshToken,
          client_key: this.configService.get('TIKTOK_CLIENT_KEY'),
          client_secret: this.configService.get('TIKTOK_CLIENT_SECRET'),
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      await this.tiktokRepo.updateAccountTokens(accountId, {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      });

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        tokenType: 'bearer',
        scope: response.data.scope.split(','),
      };
    } catch (error) {
      throw TikTokApiException.fromError(error);
    }
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

  async getMetrics(accountId: string, videoId: string): Promise<VideoMetrics> {
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
        viewCount: video.view_count,
        likeCount: video.like_count,
        commentCount: video.comment_count,
        shareCount: video.share_count,
        playCount: video.view_count, // TikTok considers views as plays
      };
    } catch (error) {
      throw new TikTokApiException('Failed to fetch video metrics', error);
    }
  }

  private async exchangeCodeForToken(code: string): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/oauth2/token`,
        {
          grant_type: 'authorization_code',
          code,
          client_key: this.tiktokConfig.clientKey,
          client_secret: this.tiktokConfig.clientSecret,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data;
    } catch (error) {
      throw new TikTokApiException('Failed to exchange code for token', error);
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

  async uploadVideo(
    accountId: string,
    videoUrl: string,
    params: CreateVideoParams,
  ): Promise<PostResponse> {
    const account = await this.tiktokRepo.getById(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    try {
      // First initialize the upload
      const uploadResponse = await this.initializeVideoUpload(
        accountId,
        params,
        {
          source: 'PULL_FROM_URL',
          videoUrl,
        },
      );

      // For PULL_FROM_URL, we just need to monitor the status
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

  private async downloadVideo(url: string): Promise<Buffer> {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
    });
    return Buffer.from(response.data, 'binary');
  }
}
