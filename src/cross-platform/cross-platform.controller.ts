import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
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
} from './helpers/cross-platform.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../decorators/current-user.decorator';
import { SocialPlatform } from '../common/enums/social-platform.enum';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Cross-Platform')
@Controller('cross-platform')
export class CrossPlatformController {
  constructor(
    private readonly crossPlatformService: CrossPlatformService,
    private readonly contentPublisherService: ContentPublisherService,
    private readonly analyticsService: AnalyticsService,
    private readonly schedulerService: SchedulerService,
  ) {}

  @Get('platforms/connected')
  async getConnectedPlatforms(@CurrentUser() userId: string) {
    return this.crossPlatformService.getConnectedPlatforms(userId);
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
  @UseInterceptors(FilesInterceptor('files'))
  async publishContent(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() createPostDto: CreateCrossPlatformPostDto,
    @CurrentUser() userId: string,
  ) {
    return this.contentPublisherService.publishContentWithMedia({
      userId,
      content: createPostDto.content,
      files: files || [],
      mediaUrls: createPostDto.mediaUrls,
      platforms: createPostDto.platforms,
    });
  }

  @Get('publish/:publishId/status')
  async getPublishStatus(
    @Param('publishId') publishId: string,
    @CurrentUser() userId: string,
  ) {
    return this.contentPublisherService.getPublishStatus(publishId, userId);
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
