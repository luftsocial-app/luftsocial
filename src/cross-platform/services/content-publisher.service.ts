import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SocialPlatform } from 'src/enum/social-platform.enum';
import { FacebookService } from 'src/platforms/facebook/facebook.service';
import { InstagramService } from 'src/platforms/instagram/instagram.service';
import { LinkedInService } from 'src/platforms/linkedin/linkedin.service';
import { PostResponse } from 'src/platforms/platform-service.interface';
import { TikTokService } from 'src/platforms/tiktok/tiktok.service';
import { Repository } from 'typeorm';
import { PublishRecord } from '../entity/publish.entity';
import {
  PublishParams,
  PublishPlatformResult,
  PublishResult,
  PublishStatus,
} from '../helpers/cross-platform.interface';

@Injectable()
export class ContentPublisherService {
  constructor(
    @InjectRepository(PublishRecord)
    private readonly publishRepo: Repository<PublishRecord>,
    private readonly facebookService: FacebookService,
    private readonly instagramService: InstagramService,
    private readonly linkedinService: LinkedInService,
    private readonly tiktokService: TikTokService,
  ) {}

  async publishContent(params: PublishParams): Promise<PublishResult> {
    // Create publishing record
    const publishRecord = await this.publishRepo.save({
      userId: params.userId,
      content: params.content,
      mediaUrls: params.mediaUrls,
      platforms: params.platforms,
      scheduleTime: params.scheduleTime,
      status: PublishStatus.PENDING,
      results: [],
    });

    const publishAttempts = await Promise.allSettled(
      params.platforms.map(async (platform) => {
        try {
          const result = await this.publishToPlatform({
            platform: platform.platform,
            accountId: platform.accountId,
            content: params.content,
            mediaUrls: params.mediaUrls,
            scheduleTime: params.scheduleTime,
            platformSpecificParams: platform.platformSpecificParams,
          });

          return {
            platform: platform.platform,
            accountId: platform.accountId,
            success: true,
            postId: result.platformPostId,
            postedAt: result.postedAt,
          } as PublishPlatformResult;
        } catch (error) {
          return {
            platform: platform.platform,
            accountId: platform.accountId,
            success: false,
            error: error.message,
          } as PublishPlatformResult;
        }
      }),
    );

    // Transform results to the correct format
    const results: PublishPlatformResult[] = publishAttempts.map((attempt) =>
      attempt.status === 'fulfilled'
        ? attempt.value
        : {
            platform: attempt.reason.platform,
            accountId: attempt.reason.accountId,
            success: false,
            error: attempt.reason.message,
          },
    );

    // Update publish record with results
    const status = this.determineOverallStatus(publishAttempts);
    await this.publishRepo.update(publishRecord.id, {
      status,
      results,
    });

    return {
      publishId: publishRecord.id,
      status,
      results,
    };
  }
  private async publishToPlatform(params: {
    platform: SocialPlatform;
    accountId: string;
    content: string;
    mediaUrls?: string[];
    scheduleTime?: Date;
    platformSpecificParams?: any;
  }): Promise<PostResponse> {
    switch (params.platform) {
      case SocialPlatform.FACEBOOK:
        return this.facebookService.post(
          params.accountId,
          params.content,
          params.mediaUrls,
          // params.platformSpecificParams,
        );

      case SocialPlatform.INSTAGRAM:
        if (!params.mediaUrls?.length) {
          throw new BadRequestException(
            'Instagram requires at least one media',
          );
        }
        return this.instagramService.post(
          params.accountId,
          params.content,
          params.mediaUrls,
          // params.platformSpecificParams,
        );

      case SocialPlatform.LINKEDIN:
        return this.linkedinService.post(
          params.accountId,
          params.content,
          params.mediaUrls,
          // params.platformSpecificParams,
        );

      case SocialPlatform.TIKTOK:
        if (!params.mediaUrls?.length) {
          throw new BadRequestException('TikTok requires a video');
        }
        return this.tiktokService.uploadVideo(
          params.accountId,
          params.mediaUrls[0], // TikTok only accepts one video
          params.platformSpecificParams,
        );

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

    if (allSuccessful) return PublishStatus.COMPLETED;
    if (allFailed) return PublishStatus.FAILED;
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
