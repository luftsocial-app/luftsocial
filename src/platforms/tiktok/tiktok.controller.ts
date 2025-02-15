import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { TikTokErrorInterceptor } from './helpers/tiktok-error.interceptor';
import { RateLimitInterceptor } from './helpers/rate-limit.interceptor';
import { TikTokService } from './tiktok.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { CreateVideoDto } from './helpers/create-video.dto.ts';
import { FileInterceptor } from '@nestjs/platform-express/multer';

@Controller('platforms/tiktok')
@UseInterceptors(TikTokErrorInterceptor, RateLimitInterceptor)
export class TikTokController {
  constructor(private readonly tiktokService: TikTokService) {}

  @Get('auth')
  async getAuthUrl(@CurrentUser() userId: string) {
    return { url: await this.tiktokService.authorize(userId) };
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @CurrentUser() userId: string,
  ) {
    return this.tiktokService.handleCallback(code);
  }

  // For URL-based uploads
  @Post(':accountId/videos/url')
  async uploadVideoFromUrl(
    @Param('accountId') accountId: string,
    @Body() createVideoDto: CreateVideoDto,
  ) {
    return this.tiktokService.uploadVideo(
      accountId,
      createVideoDto.videoUrl,
      createVideoDto,
    );
  }

  // For file-based uploads
  @Post(':accountId/videos/file')
  @UseInterceptors(FileInterceptor('video'))
  async uploadVideoFile(
    @Param('accountId') accountId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() createVideoDto: CreateVideoDto,
  ) {
    const videoBuffer = Buffer.from(file.buffer);
    return this.tiktokService.uploadLocalVideo(
      accountId,
      videoBuffer,
      createVideoDto,
    );
  }

  @Get(':accountId/videos/:videoId/comments')
  async getComments(
    @Param('accountId') accountId: string,
    @Param('videoId') videoId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.tiktokService.getComments(accountId, videoId, cursor);
  }

  @Get(':accountId/videos/:publishId/status')
  async getVideoStatus(
    @Param('accountId') accountId: string,
    @Param('publishId') publishId: string,
  ) {
    return this.tiktokService.getVideoStatus(accountId, publishId);
  }

  @Get(':accountId/videos/:videoId/metrics')
  async getMetrics(
    @Param('accountId') accountId: string,
    @Param('videoId') videoId: string,
  ) {
    return this.tiktokService.getPostMetrics(accountId, videoId);
  }

  @Get(':accountId/analytics')
  async getAnalytics(
    @Param('accountId') accountId: string,
    @Query('days') days: number = 7,
  ) {
    return this.tiktokService.getAccountAnalytics(accountId);
  }

  @Get(':accountId/videos/:videoId/performance')
  async getVideoPerformance(
    @Param('accountId') accountId: string,
    @Param('videoId') videoId: string,
    @Query('days') days: number = 7,
  ) {
    return this.tiktokService.getVideoPerformance(accountId, videoId, days);
  }
}
