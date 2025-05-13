import { Injectable, Logger } from '@nestjs/common';
import { CrossPlatformService } from 'src/cross-platform/cross-platform.service';
import { ContentPublisherService } from 'src/cross-platform/services/content-publisher.service';

export interface PublishResult {
  success: boolean;
  publishId?: string;
  platformResults?: any[];
  error?: string;
}

@Injectable()
export class PublisherAdapterService {
  private readonly logger = new Logger(PublisherAdapterService.name);

  constructor(
    private readonly contentPublisherService: ContentPublisherService,
    private readonly crossPlatformService: CrossPlatformService,
  ) {}

  async validatePlatformsForUser(
    userId: string,
    platforms: any[],
  ): Promise<void> {
    // Validate if the user has connected platforms
    const connectedPlatforms =
      await this.crossPlatformService.getConnectedPlatforms(userId);

    if (!connectedPlatforms || connectedPlatforms.length === 0) {
      throw new Error(
        'No connected platforms found. Please connect at least one platform.',
      );
    }

    // Validate if the selected platforms are connected
    const selectedPlatformNames = platforms.map(
      (platform) => platform.platform,
    );
    const connectedPlatformNames = connectedPlatforms.map(
      (platform) => platform.platform,
    );

    const invalidPlatforms = selectedPlatformNames.filter(
      (platform) => !connectedPlatformNames.includes(platform),
    );

    if (invalidPlatforms.length > 0) {
      throw new Error(
        `The following platforms are not connected: ${invalidPlatforms.join(', ')}. Please connect them before publishing.`,
      );
    }
  }

  async publishContent(
    userId: string,
    content: string,
    platforms: any[],
    mediaUrls: string[],
  ): Promise<PublishResult> {
    try {
      // Validate platforms
      await this.validatePlatformsForUser(userId, platforms);

      // Call the external service
      const result = await this.contentPublisherService.publishContentWithMedia(
        {
          userId,
          content,
          platforms,
          mediaUrls,
        },
      );

      return {
        success: true,
        publishId: result.publishId,
        platformResults: result.results,
      };
    } catch (error) {
      this.logger.error(`Publishing failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
