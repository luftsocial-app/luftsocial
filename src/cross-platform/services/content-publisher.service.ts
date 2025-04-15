import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import axios from 'axios';
import { Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { FacebookService } from '../../platforms/facebook/facebook.service';
import { InstagramService } from '../../platforms/instagram/instagram.service';
import { LinkedInService } from '../../platforms/linkedin/linkedin.service';
import { TikTokService } from '../../platforms/tiktok/tiktok.service';
import { Repository } from 'typeorm';
import { PublishRecord } from '../entities/publish.entity';
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
import { RetryQueueService } from './retry-queue.service';
import { PinoLogger } from 'nestjs-pino';
import { CreateCrossPlatformPostDto } from '../helpers/dtos/cross-platform.dto';

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
    private readonly retryQueueService: RetryQueueService,
    private readonly logger: PinoLogger,
    @InjectQueue('platform-publish') private publishQueue: Queue,
  ) {
    this.logger.setContext(PublishRecord.name);
  }

  MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  public validateFiles(files: Express.Multer.File[]): void {
    const allowedMimeTypes = [
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      // Videos
      'video/mp4',
      'video/quicktime',
      'video/avi',
      'video/webm',
      // Documents
      'application/pdf',
    ];

    for (const file of files) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new HttpException(
          {
            message: 'File validation failed',
            errors: [
              `Unsupported file type: ${file.mimetype}. Allowed types: images, videos, and PDFs.`,
            ],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (file.size > this.MAX_FILE_SIZE) {
        throw new HttpException(
          {
            message: 'File validation failed',
            errors: [`File size exceeds the 50MB limit: ${file.originalname}`],
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  private async getMimeTypeFromUrl(url: string): Promise<string | null> {
    try {
      const response = await axios.head(url);
      return response.headers['content-type'] || null;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return null;
    }
  }

  public async validateMediaRequirements(
    dto: CreateCrossPlatformPostDto,
    files: Express.Multer.File[],
  ): Promise<void> {
    const errors: string[] = [];

    const mimeTypesFromFiles = files?.map((file) => file.mimetype) || [];

    const mimeTypesFromUrls: string[] = [];

    // Check and fetch MIME types from URLs
    if (dto.mediaUrls?.length) {
      for (const url of dto.mediaUrls) {
        const type = await this.getMimeTypeFromUrl(url);
        if (type) {
          mimeTypesFromUrls.push(type);
        } else {
          errors.push(`Could not determine MIME type for URL: ${url}`);
        }
      }
    }

    const allMimeTypes = [...mimeTypesFromFiles, ...mimeTypesFromUrls];

    const facebookPlatform = dto.platforms.find(
      (p) => p.platform === SocialPlatform.FACEBOOK,
    );

    const instagramPlatform = dto.platforms.find(
      (p) => p.platform === SocialPlatform.INSTAGRAM,
    );
    const tiktokPlatform = dto.platforms.find(
      (p) => p.platform === SocialPlatform.TIKTOK,
    );

    const instagramRequiredTypes = ['image/jpeg', 'image/png', 'video/mp4'];
    const tiktokRequiredTypes = ['video/mp4'];

    if (facebookPlatform && dto.mediaUrls) {
      const invalidMimeTypes = !allMimeTypes.some((type) =>
        instagramRequiredTypes.includes(type),
      );
      if (invalidMimeTypes) {
        errors.push(
          `Facebook only supports: ${instagramRequiredTypes.join(
            ', ',
          )}. Found: ${allMimeTypes.join(', ') || 'none'}`,
        );
      }
    }

    if (instagramPlatform) {
      if (allMimeTypes.length === 0) {
        errors.push('Instagram posts require at least one media file or URL.');
      } else if (
        !allMimeTypes.some((type) => instagramRequiredTypes.includes(type))
      ) {
        errors.push(
          `Instagram only supports: ${instagramRequiredTypes.join(
            ', ',
          )}. Found: ${allMimeTypes.join(', ') || 'none'}`,
        );
      }
    }

    if (tiktokPlatform) {
      if (allMimeTypes.length === 0) {
        errors.push('TikTok posts require at least one video file or URL.');
      } else if (
        !allMimeTypes.some((type) => tiktokRequiredTypes.includes(type))
      ) {
        errors.push(
          `TikTok only supports: ${tiktokRequiredTypes.join(
            ', ',
          )}. Found: ${allMimeTypes.join(', ') || 'none'}`,
        );
      }
    }

    if (errors.length > 0) {
      throw new HttpException(
        {
          message: 'Media validation failed',
          errors,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async publishContentWithMedia(params: PublishParams): Promise<PublishResult> {
    this.logger.info(
      `Starting content publish for user ${params.userId} with ${params.platforms.length} platforms`,
    );
    try {
      // Create publishing record first to get an ID
      const publishRecord = await this.publishRepo.save({
        userId: params.userId,
        content: params.content,
        platforms: params.platforms.map((platform) => ({
          platform: platform.platform,
        })),
        scheduleTime: params.scheduleTime,
        status: PublishStatus.PENDING,
      });

      this.logger.info(`Created publish record with ID ${publishRecord.id}`);

      // Process and upload media with deduplication
      const mediaItems = await this.processAndUploadMedia(
        params.userId,
        params.files || [],
        params.mediaUrls || [],
        publishRecord.id,
      );

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
              content: params.content,
              mediaUrls,
              scheduleTime: params.scheduleTime,
              platformSpecificParams: platform.platformSpecificParams,
              media: mediaItems, // Pass full media items for platform-specific handling
            });

            this.logger.info(
              `Successfully published to ${platform.platform} for account ${platform.accountId}`,
            );

            return {
              platform: platform.platform,
              accountId: platform.accountId,
              success: true,
              postId: result.platformPostId,
              postedAt: result.postedAt,
            };
          } catch (error) {
            // Log the failure
            this.logger.error(
              `Failed to publish to ${platform.platform} for account ${platform.accountId}: ${error.message}`,
              error.stack,
            );

            // Add to retry queue
            await this.retryQueueService.addToRetryQueue({
              publishRecordId: publishRecord.id,
              platform: platform.platform,
              accountId: platform.accountId,
              content: params.content,
              mediaUrls,
              platformSpecificParams: platform.platformSpecificParams,
              retryCount: 0,
            });

            return {
              platform: platform.platform,
              accountId: platform.accountId,
              success: false,
              error: error.message,
              scheduled_for_retry: true,
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
                scheduled_for_retry: true,
              },
        ),
      });

      this.logger.info(
        `Completed publish process for record ${publishRecord.id} with status ${status}`,
      );

      return {
        publishId: publishRecord.id,
        status,
        mediaItems,
        results: results.map((result) =>
          result.status === 'fulfilled' ? result.value : result.reason,
        ),
      };
    } catch (error) {
      this.logger.error(
        `Error in publishContentWithMedia: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Process and upload media with deduplication
   */
  private async processAndUploadMedia(
    userId: string,
    files: Express.Multer.File[],
    mediaUrls: string[],
    publishId: string,
  ): Promise<MediaStorageItem[]> {
    this.logger.info(
      `Processing media: ${files.length} files and ${mediaUrls.length} URLs`,
    );

    const mediaItems: MediaStorageItem[] = [];

    // Convert files and mediaUrls to MediaItem format
    const combinedMedia: MediaItem[] = [
      ...files.map((file) => ({
        file,
        url: undefined,
        description: undefined,
      })),
      ...mediaUrls.map((url) => ({
        url,
        file: undefined,
        description: undefined,
      })),
    ];

    // Upload media items with deduplication
    for (const mediaItem of combinedMedia) {
      try {
        if (mediaItem.file) {
          // Calculate hash for deduplication
          const fileHash = await this.mediaStorageService.calculateFileHash(
            mediaItem.file.buffer,
          );

          // Check if file with same hash already exists
          const existingMedia =
            await this.mediaStorageService.findMediaByHash(fileHash);

          if (existingMedia) {
            this.logger.info(`Using existing media with hash ${fileHash}`);
            mediaItems.push(existingMedia);
          } else {
            const uploadedFiles =
              await this.mediaStorageService.uploadPostMedia(
                userId,
                [mediaItem.file],
                publishId,
                undefined,
                fileHash, // Pass hash for storage
              );
            mediaItems.push(...uploadedFiles);
          }
        } else if (mediaItem.url) {
          // For URLs, we need to download first to calculate hash
          const downloadedMedia =
            await this.mediaStorageService.uploadMediaFromUrl(
              userId,
              mediaItem.url,
              publishId,
              undefined,
              true, // Enable deduplication
            );
          mediaItems.push(downloadedMedia);
        }
      } catch (error) {
        this.logger.error(
          `Failed to upload media: ${error.message}`,
          error.stack,
        );
        // Continue with other media even if one fails
      }
    }

    return mediaItems;
  }

  /**
   * Publish to a specific platform
   */
  private async publishToPlatform(params: {
    platform: SocialPlatform;
    content: string;
    mediaUrls?: string[];
    scheduleTime?: Date;
    media?: MediaStorageItem[];
    platformSpecificParams?: any;
  }): Promise<{
    platformPostId: string;
    postedAt: Date;
    platformSpecificData?: any;
  }> {
    console.log('Publishing to platform:', params.platformSpecificParams);
    try {
      switch (params.platform) {
        case SocialPlatform.FACEBOOK:
          const fbResult = await this.facebookService.createPagePost(
            params.platformSpecificParams?.pageId,
            { ...params.platformSpecificParams, media: params.media },
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
            params.platformSpecificParams?.accountId,
            params.platformSpecificParams,
            params.media,
          );
          return {
            platformPostId: igResult.platformPostId,
            postedAt: igResult.postedAt,
          };

        case SocialPlatform.LINKEDIN:
          const liResult = await this.linkedinService.post(
            params.platformSpecificParams?.accountId,
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
            params.platformSpecificParams?.accountId,
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
    } catch (error) {
      this.logger.error(
        `Error publishing to ${params.platform}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Determine the overall status of the publish operation
   */
  private determineOverallStatus(
    results: PromiseSettledResult<PublishPlatformResult>[],
  ): PublishStatus {
    const allSuccessful = results.every(
      (r) => r.status === 'fulfilled' && r.value.success,
    );
    const allFailed = results.every(
      (r) =>
        r.status === 'rejected' ||
        (r.status === 'fulfilled' && !r.value.success),
    );

    if (allSuccessful) {
      return PublishStatus.COMPLETED;
    }
    if (allFailed) {
      return PublishStatus.FAILED;
    }
    return PublishStatus.PARTIALLY_COMPLETED;
  }

  /**
   * Get the status of a publish record
   */
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

  /**
   * Retry a failed publish
   */
  async retryPublish(
    publishId: string,
    platformId: string,
    accountId: string,
  ): Promise<boolean> {
    this.logger.info(
      `Retrying publish for record ${publishId} on platform ${platformId}`,
    );

    try {
      const publishRecord = await this.publishRepo.findOne({
        where: { id: publishId },
      });

      if (!publishRecord) {
        throw new NotFoundException('Publish record not found');
      }

      // Find the failed platform result
      const platformData = publishRecord.platforms.find(
        (p) => p.platform === platformId && p.accountId === accountId,
      );

      if (!platformData) {
        throw new NotFoundException(
          'Platform data not found in publish record',
        );
      }

      // Add to retry queue with increased priority
      await this.publishQueue.add(
        'retry-platform-publish',
        {
          publishRecordId: publishId,
          platform: platformId,
          accountId,
          content: publishRecord.content,
          mediaUrls: publishRecord.mediaItems.map((item) => item.url),
          platformSpecificParams: platformData.platformSpecificParams,
          retryCount: 0,
        },
        {
          priority: 1,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 60000, // 1 minute
          },
        },
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to retry publish ${publishId}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Find a publish record by ID
   */
  async findPublishById(
    publishId: string,
    userId: string,
  ): Promise<PublishRecord | null> {
    this.logger.info(`Finding publish record ${publishId} for user ${userId}`);

    try {
      const record = await this.publishRepo.findOne({
        where: { id: publishId, userId },
      });

      return record;
    } catch (error) {
      this.logger.error(
        `Error finding publish record: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Find publish records for a user with pagination
   */
  async findUserPublishRecords(
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: PublishStatus,
  ): Promise<{
    items: PublishRecord[];
    total: number;
    page: number;
    limit: number;
  }> {
    this.logger.info(
      `Finding publish records for user ${userId}, page ${page}, limit ${limit}`,
    );

    try {
      const query = this.publishRepo
        .createQueryBuilder('publish')
        .where('publish.userId = :userId', { userId });

      if (status) {
        query.andWhere('publish.status = :status', { status });
      }

      const total = await query.getCount();

      const items = await query
        .orderBy('publish.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getMany();

      return {
        items,
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(
        `Error finding publish records: ${error.message}`,
        error.stack,
      );
      return {
        items: [],
        total: 0,
        page,
        limit,
      };
    }
  }

  /**
   * Update the status of a publish record
   */
  async updatePublishStatus(
    publishId: string,
    status: PublishStatus,
  ): Promise<boolean> {
    this.logger.info(
      `Updating publish record ${publishId} status to ${status}`,
    );

    try {
      const result = await this.publishRepo.update(
        { id: publishId },
        { status },
      );

      return result.affected > 0;
    } catch (error) {
      this.logger.error(
        `Error updating publish status: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}
