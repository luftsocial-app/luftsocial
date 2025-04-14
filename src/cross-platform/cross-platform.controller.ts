import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { CrossPlatformService } from './cross-platform.service';
import { ContentPublisherService } from './services/content-publisher.service';
import { AnalyticsService } from './services/analytics.service';
import { SchedulerService } from './services/scheduler.service';
import {
  AnalyticsDto,
  ContentPerformanceDto,
  CreateCrossPlatformPostDto,
  ScheduleCrossPlatformPostDto,
  ScheduleFiltersDto,
  UpdateScheduleDto,
} from './helpers/dtos/cross-platform.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../decorators/current-user.decorator';
import { SocialPlatform } from '../common/enums/social-platform.enum';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  PublishResult,
  PublishStatus,
} from './helpers/cross-platform.interface';
import { PinoLogger } from 'nestjs-pino';
import { RetryQueueService } from './services/retry-queue.service';
import { CrossPlatformValidationPipe } from '../common/pipes/cross-platform-validation.pipe';

@ApiTags('Cross-Platform')
@ApiBearerAuth()
@Controller('cross-platform')
export class CrossPlatformController {
  constructor(
    private readonly crossPlatformService: CrossPlatformService,
    private readonly contentPublisherService: ContentPublisherService,
    private readonly analyticsService: AnalyticsService,
    private readonly schedulerService: SchedulerService,
    private readonly logger: PinoLogger,
    private readonly retryQueueService: RetryQueueService,
  ) {
    this.logger.setContext(CrossPlatformController.name);
  }

  @Get('platforms/connected')
  async getConnectedPlatforms(@CurrentUser() user: any) {
    return this.crossPlatformService.getConnectedPlatforms(user.userId);
  }

  @Delete('platforms/:platform/:accountId')
  async disconnectPlatform(
    @Param('platform', new ParseEnumPipe(SocialPlatform))
    platform: SocialPlatform,
    @Param('accountId')
    accountId: string,
    @CurrentUser() userId: string,
  ) {
    return this.crossPlatformService.disconnectPlatform(
      userId,
      platform,
      accountId,
    );
  }

  // Content Publishing Endpoints
  @Post('publish')
  @ApiOperation({ summary: 'Publish content across multiple platforms' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Cross-platform post with optional media files',
    type: CreateCrossPlatformPostDto,
  })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
      },
    }),
  )
  async publishContent(
    @UploadedFiles() files: Express.Multer.File[],
    @Body(new CrossPlatformValidationPipe())
    createPostDto: CreateCrossPlatformPostDto,
    @CurrentUser() user: any,
  ): Promise<PublishResult> {
    try {
      const { userId } = user;
      // Validate if the user has connected platforms
      const connectedPlatforms =
        await this.crossPlatformService.getConnectedPlatforms(userId);
      if (!connectedPlatforms || connectedPlatforms.length === 0) {
        throw new HttpException(
          'No connected platforms found. Please connect at least one platform.',
          HttpStatus.BAD_REQUEST,
        );
      }
      // Validate if the user has selected platforms
      if (!createPostDto.platforms || createPostDto.platforms.length === 0) {
        throw new HttpException(
          'No platforms selected for publishing. Please select at least one platform.',
          HttpStatus.BAD_REQUEST,
        );
      }
      // Validate if the selected platforms are connected
      const selectedPlatforms = createPostDto.platforms.map(
        (platform) => platform.platform,
      );
      const connectedPlatformNames = connectedPlatforms.map(
        (platform) => platform.platform,
      );
      const invalidPlatforms = selectedPlatforms.filter(
        (platform) => !connectedPlatformNames.includes(platform),
      );
      if (invalidPlatforms.length > 0) {
        throw new HttpException(
          `The following platforms are not connected: ${invalidPlatforms.join(
            ', ',
          )}. Please connect them before publishing.`,
          HttpStatus.BAD_REQUEST,
        );
      }
      // Validate required media for platforms that need them
      const instagramPlatform = createPostDto.platforms.find(
        (p) => p.platform === SocialPlatform.INSTAGRAM,
      );
      const tiktokPlatform = createPostDto.platforms.find(
        (p) => p.platform === SocialPlatform.TIKTOK,
      );

      // Check if media is provided when required
      if (
        (instagramPlatform || tiktokPlatform) &&
        !files?.length &&
        !createPostDto.mediaUrls?.length
      ) {
        throw new HttpException(
          'Media files are required for Instagram and TikTok posts',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate file types
      if (files && files.length > 0) {
        this.contentPublisherService.validateFiles(files);
      }

      // Check platform-specific media requirements
      await this.contentPublisherService.validateMediaRequirements(
        createPostDto,
        files,
      );

      const result = await this.contentPublisherService.publishContentWithMedia(
        {
          userId: userId,
          content: createPostDto.content,
          files: files || [],
          mediaUrls: createPostDto.mediaUrls || [],
          platforms: createPostDto.platforms,
        },
      );

      this.logger.info(
        `Successfully published content with ID ${result.publishId}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to publish content: ${error.message}`,
        error.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to publish content: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('publish/:publishId')
  @ApiOperation({ summary: 'Get status of a publish operation' })
  @ApiParam({ name: 'publishId', description: 'ID of the publish operation' })
  async getPublishStatus(
    @Param('publishId') publishId: string,
    @CurrentUser() userId: string,
  ): Promise<any> {
    try {
      const status = await this.contentPublisherService.getPublishStatus(
        publishId,
        userId,
      );

      // Get pending retries if any
      const pendingRetries =
        await this.retryQueueService.getPendingRetries(publishId);

      const record = await this.contentPublisherService.findPublishById(
        publishId,
        userId,
      );

      return {
        id: publishId,
        status,
        results: record?.results || [],
        platforms: record?.platforms || [],
        content: record?.content,
        mediaItems: record?.mediaItems || [],
        createdAt: record?.createdAt,
        pendingRetries,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get publish status: ${error.message}`,
        error.stack,
      );

      throw new HttpException(
        `Failed to get publish status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('publishes')
  @ApiOperation({ summary: 'Get list of publish operations for a user' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by publish status',
  })
  async getUserPublishes(
    @CurrentUser() userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: PublishStatus,
  ): Promise<any> {
    try {
      return await this.contentPublisherService.findUserPublishRecords(
        userId,
        page,
        limit,
        status,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get user publishes: ${error.message}`,
        error.stack,
      );

      throw new HttpException(
        `Failed to get user publishes: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('retry/:publishId/:platform/:accountId')
  @ApiOperation({ summary: 'Retry a failed platform post' })
  @ApiParam({ name: 'publishId', description: 'ID of the publish operation' })
  @ApiParam({ name: 'platform', description: 'Platform to retry' })
  @ApiParam({ name: 'accountId', description: 'Account ID to retry' })
  async retryPlatformPublish(
    @Param('publishId') publishId: string,
    @Param('platform') platform: string,
    @Param('accountId') accountId: string,
    @CurrentUser() userId: string,
  ): Promise<any> {
    try {
      // Check if user has access to this publish record
      await this.contentPublisherService.getPublishStatus(publishId, userId);

      // Initiate retry with the existing method
      const result = await this.contentPublisherService.retryPublish(
        publishId,
        platform,
        accountId,
      );

      if (result) {
        this.logger.info(
          `Retry initiated for publish ${publishId} on platform ${platform}`,
        );
        return { success: true, message: 'Retry initiated successfully' };
      } else {
        throw new HttpException(
          'Failed to initiate retry',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to retry platform publish: ${error.message}`,
        error.stack,
      );

      throw new HttpException(
        `Failed to retry platform publish: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('retry/:retryId')
  @ApiOperation({ summary: 'Cancel a pending retry' })
  @ApiParam({ name: 'retryId', description: 'ID of the retry job' })
  async cancelRetry(@Param('retryId') retryId: string): Promise<any> {
    try {
      const result = await this.retryQueueService.cancelRetry(retryId);

      if (result) {
        this.logger.info(`Retry ${retryId} cancelled successfully`);
        return { success: true, message: 'Retry cancelled successfully' };
      } else {
        throw new HttpException(
          'Failed to cancel retry',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to cancel retry: ${error.message}`,
        error.stack,
      );

      throw new HttpException(
        `Failed to cancel retry: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('cancel/:publishId')
  @ApiOperation({ summary: 'Cancel a scheduled publish' })
  @ApiParam({
    name: 'publishId',
    description: 'ID of the publish operation to cancel',
  })
  async cancelScheduledPublish(
    @Param('publishId') publishId: string,
    @CurrentUser() userId: string,
  ): Promise<any> {
    try {
      // First check if the publish record exists and belongs to the user
      await this.contentPublisherService.getPublishStatus(publishId, userId);

      // We'll need to update this method
      const result = await this.contentPublisherService.updatePublishStatus(
        publishId,
        PublishStatus.CANCELED,
      );

      if (result) {
        this.logger.info(
          `Scheduled publish ${publishId} cancelled successfully`,
        );
        return {
          success: true,
          message: 'Scheduled publish cancelled successfully',
        };
      } else {
        throw new HttpException(
          'Failed to cancel scheduled publish',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to cancel scheduled publish: ${error.message}`,
        error.stack,
      );

      throw new HttpException(
        `Failed to cancel scheduled publish: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  // Scheduling Endpoints
  @Post('schedule')
  @UseInterceptors(FilesInterceptor('files'))
  async schedulePost(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() schedulePostDto: ScheduleCrossPlatformPostDto,
    @CurrentUser() userId: string,
  ) {
    return this.schedulerService.schedulePost({
      userId,
      content: schedulePostDto.content,
      files: files || [],
      mediaUrls: schedulePostDto.mediaUrls,
      platforms: schedulePostDto.platforms,
      scheduledTime: new Date(schedulePostDto.scheduledTime),
    });
  }

  @Get('schedule')
  async getScheduledPosts(
    @Query() filters: ScheduleFiltersDto,
    @CurrentUser() userId: string,
  ) {
    const transformedFilters = {
      ...filters,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    };

    return this.schedulerService.getScheduledPosts(userId, transformedFilters);
  }

  @Put('schedule/:postId')
  async updateScheduledPost(
    @Param('postId') postId: string,
    @Body() updateScheduleDto: UpdateScheduleDto,
    @CurrentUser() userId: string,
  ) {
    const serviceParams = {
      ...updateScheduleDto,
      scheduledTime: updateScheduleDto.scheduledTime
        ? new Date(updateScheduleDto.scheduledTime)
        : undefined,
    };

    return this.schedulerService.updateScheduledPost(
      postId,
      userId,
      serviceParams,
    );
  }

  @Delete('schedule/:postId')
  async cancelScheduledPost(
    @Param('postId') postId: string,
    @CurrentUser() userId: string,
  ) {
    return this.schedulerService.cancelScheduledPost(postId, userId);
  }

  // Analytics Endpoints
  @Get('analytics')
  async getAnalytics(
    @Query() analyticsDto: AnalyticsDto,
    @CurrentUser() userId: string,
  ) {
    return this.analyticsService.getAccountAnalytics({
      userId,
      ...analyticsDto,
    });
  }

  @Get('analytics/content')
  async getContentPerformance(
    @Query() contentPerformanceDto: ContentPerformanceDto,
    @CurrentUser() userId: string,
  ) {
    return this.analyticsService.getContentPerformance({
      userId,
      ...contentPerformanceDto,
    });
  }
}
