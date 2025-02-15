import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { SocialPlatform } from 'src/enum/social-platform.enum';
import { CrossPlatformService } from './cross-platform.service';
import { ContentPublisherService } from './services/content-publisher.service';
import { AnalyticsService } from './services/analytics.service';
import { SchedulerService } from './services/scheduler.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import {
  AnalyticsDto,
  ContentPerformanceDto,
  CreateCrossPlatformPostDto,
  ScheduleCrossPlatformPostDto,
  ScheduleFiltersDto,
  UpdateScheduleDto,
} from './helpers/cross-platform.dto';

@Controller('cross-platform')
export class CrossPlatformController {
  constructor(
    private readonly crossPlatformService: CrossPlatformService,
    private readonly contentPublisherService: ContentPublisherService,
    private readonly analyticsService: AnalyticsService,
    private readonly schedulerService: SchedulerService,
  ) {}

  // Platform Connection Endpoints
  @Get('platforms/connect/:platform')
  async getAuthUrl(
    @Param('platform') platform: SocialPlatform,
    @CurrentUser() userId: string,
  ) {
    return {
      url: await this.crossPlatformService.connectPlatform(userId, platform),
    };
  }

  @Get('platforms/callback/:platform')
  async handleCallback(
    @Param('platform') platform: SocialPlatform,
    @Query('code') code: string,
    @Query('state') state: string,
    @CurrentUser() userId: string,
  ) {
    return this.crossPlatformService.handleCallback(
      platform,
      code,
      state,
      userId,
    );
  }

  @Get('platforms/connected')
  async getConnectedPlatforms(@CurrentUser() userId: string) {
    return this.crossPlatformService.getConnectedPlatforms(userId);
  }

  @Delete('platforms/:platform/:accountId')
  async disconnectPlatform(
    @Param('platform') platform: SocialPlatform,
    @Param('accountId') accountId: string,
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
  async publishContent(
    @Body() createPostDto: CreateCrossPlatformPostDto,
    @CurrentUser() userId: string,
  ) {
    return this.contentPublisherService.publishContent({
      userId,
      ...createPostDto,
    });
  }

  @Get('publish/:publishId/status')
  async getPublishStatus(
    @Param('publishId') publishId: string,
    @CurrentUser() userId: string,
  ) {
    return this.contentPublisherService.getPublishStatus(publishId);
  }

  // Scheduling Endpoints
  @Post('schedule')
  async schedulePost(
    @Body() schedulePostDto: ScheduleCrossPlatformPostDto,
    @CurrentUser() userId: string,
  ) {
    return this.schedulerService.schedulePost({
      userId,
      ...schedulePostDto,
    });
  }

  @Get('schedule')
  async getScheduledPosts(
    @Query() filters: ScheduleFiltersDto,
    @CurrentUser() userId: string,
  ) {
    return this.schedulerService.getScheduledPosts(userId, filters);
  }

  @Put('schedule/:postId')
  async updateScheduledPost(
    @Param('postId') postId: string,
    @Body() updateScheduleDto: UpdateScheduleDto,
    @CurrentUser() userId: string,
  ) {
    return this.schedulerService.updateScheduledPost(
      postId,
      userId,
      updateScheduleDto,
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
