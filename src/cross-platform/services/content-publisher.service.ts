import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FacebookService } from '../../platforms/facebook/facebook.service';
import { InstagramService } from '../../platforms/instagram/instagram.service';
import { LinkedInService } from '../../platforms/linkedin/linkedin.service';
import { TikTokService } from '../../platforms/tiktok/tiktok.service';
import { Repository } from 'typeorm';
import { PublishRecord } from '../../entities/cross-platform-entities/publish.entity';
import {
  PublishParams,
  PublishPlatformResult,
  PublishResult,
  PublishStatus,
} from '../helpers/cross-platform.interface';
import { MediaItem } from '../../platforms/platform-service.interface';
import { SocialPlatform } from '../../common/enums/social-platform.enum';
import { MediaStorageService } from '../../asset-management/media-storage/media-storage.service';
import { MediaStorageItem } from '../../asset-management/media-storage/media-storage.dto';

@Injectable()
export class ContentPublisherService {
  constructor(
    @InjectRepository(PublishRecord)
    private readonly publishRepo: Repository<PublishRecord>,
    private readonly facebookService: FacebookService,
    private readonly mediaStorageService: MediaStorageService,
    private readonly instagramService: InstagramService,
    private readonly linkedinService: LinkedInService,
    private readonly tiktokService: TikTokService,
  ) { }

  async publishContentWithMedia(params: PublishParams): Promise<PublishResult> {
    // Create publishing record first to get an ID
    const publishRecord = await this.publishRepo.save({
      userId: params.userId,
      content: params.content,
      platforms: params.platforms,
      scheduleTime: params.scheduleTime,
      status: PublishStatus.PENDING,
    });

    // Process and upload media
    const mediaItems: MediaStorageItem[] = [];

    // Convert files and mediaUrls to MediaItem format
    const combinedMedia: MediaItem[] = [
      ...(params.files?.map((file) => ({
        file,
        url: undefined,
        description: undefined,
      })) || []),
      ...(params.mediaUrls?.map((url) => ({
        url,
        file: undefined,
        description: undefined,
      })) || []),
    ];

    // Upload media items
    for (const mediaItem of combinedMedia) {
      if (mediaItem.file) {
        const uploadedFiles = await this.mediaStorageService.uploadPostMedia(
          params.userId,
          [mediaItem.file],
          publishRecord.id,
        );
        mediaItems.push(...uploadedFiles);
      } else if (mediaItem.url) {
        const uploadedMedia = await this.mediaStorageService.uploadMediaFromUrl(
          params.userId,
          mediaItem.url,
          publishRecord.id,
        );
        mediaItems.push(uploadedMedia);
      }
    }

    // Update record with media
    await this.publishRepo.update(publishRecord.id, {
      mediaItems,
    });

    // Now post to platforms with uploaded media URLs
    const mediaUrls = mediaItems.map((item) => item.url);

    const results = await Promise.allSettled(
      params.platforms.map(async (platform) => {
        try {
          const result = await this.publishToPlatform({
            platform: platform.platform,
            accountId: platform.accountId,
            content: params.content,
            mediaUrls,
            scheduleTime: params.scheduleTime,
            platformSpecificParams: platform.platformSpecificParams,
            media: combinedMedia, // Pass full media items for platform-specific handling
          });

          return {
            platform: platform.platform,
            accountId: platform.accountId,
            success: true,
            postId: result.platformPostId,
            postedAt: result.postedAt,
          };
        } catch (error) {
          return {
            platform: platform.platform,
            accountId: platform.accountId,
            success: false,
            error: error.message,
          };
        }
      }),
    );

    // Update publish record with results
    const status = this.determineOverallStatus(results);
    await this.publishRepo.update(publishRecord.id, {
      status,
      results: results.map((result) =>
        result.status === 'fulfilled'
          ? result.value
          : {
            platform: result.reason.platform,
            accountId: result.reason.accountId,
            success: false,
            error: result.reason.message,
          },
      ),
    });

    return {
      publishId: publishRecord.id,
      status,
      mediaItems,
      results: results.map((result) =>
        result.status === 'fulfilled' ? result.value : result.reason,
      ),
    };
  }

  private async publishToPlatform(params: {
    platform: SocialPlatform;
    accountId: string;
    content: string;
    mediaUrls?: string[];
    scheduleTime?: Date;
    media?: MediaItem[];
    platformSpecificParams?: any;
  }): Promise<{
    platformPostId: string;
    postedAt: Date;
    platformSpecificData?: any;
  }> {
    switch (params.platform) {
      case SocialPlatform.FACEBOOK:
        const fbResult = await this.facebookService.post(
          params.accountId,
          params.content,
          params.media,
        );
        return {
          platformPostId: fbResult.platformPostId,
          postedAt: fbResult.postedAt,
        };

      case SocialPlatform.INSTAGRAM:
        if (!params.media?.length) {
          throw new BadRequestException(
            'Instagram requires at least one media',
          );
        }
        const igResult = await this.instagramService.post(
          params.accountId,
          params.platformSpecificParams,
          params.media,
        );
        return {
          platformPostId: igResult.platformPostId,
          postedAt: igResult.postedAt,
        };

      case SocialPlatform.LINKEDIN:
        const liResult = await this.linkedinService.post(
          params.accountId,
          params.platformSpecificParams,
          params.media,
        );
        return {
          platformPostId: liResult.platformPostId,
          postedAt: liResult.postedAt,
        };

      case SocialPlatform.TIKTOK:
        if (!params.media?.length) {
          throw new BadRequestException('TikTok requires a video');
        }
        const ttResult = await this.tiktokService.post(
          params.accountId,
          params.platformSpecificParams,
          params.media, // TikTok only accepts one video
        );
        return {
          platformPostId: ttResult.platformPostId,
          postedAt: ttResult.postedAt,
        };

      default:
        throw new BadRequestException(
          `Unsupported platform: ${params.platform}`,
        );
    }
  }
  private determineOverallStatus(
    results: PromiseSettledResult<PublishPlatformResult>[],
  ): PublishStatus {
    const allSuccessful = results.every((r) => r.status === 'fulfilled');
    const allFailed = results.every((r) => r.status === 'rejected');

    if (allSuccessful) {
      return PublishStatus.COMPLETED;
    }
    if (allFailed) {
      return PublishStatus.FAILED;
    }
    return PublishStatus.PARTIALLY_COMPLETED;
  }

  async getPublishStatus(
    publishId: string,
    userId: string,
  ): Promise<PublishStatus> {
    const publishRecord = await this.publishRepo.findOne({
      where: { id: publishId, userId },
    });

    if (!publishRecord) {
      throw new NotFoundException('Publish record not found');
    }

    return publishRecord.status;
  }
}
