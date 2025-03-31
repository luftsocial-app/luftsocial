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
import { CreateVideoDto } from './helpers/create-video.dto.ts';
import { FileInterceptor } from '@nestjs/platform-express/multer';
import { MediaItem } from '../platform-service.interface';

@Controller('platforms/tiktok')
@UseInterceptors(TikTokErrorInterceptor, RateLimitInterceptor)
export class TikTokController {
  constructor(private readonly tiktokService: TikTokService) {}

  @Post(':accountId/videos')
  @UseInterceptors(FileInterceptor('video'))
  async uploadVideoFile(
    @Param('accountId') accountId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() createVideoDto: CreateVideoDto,
  ) {
    const { videoUrl } = createVideoDto;
    // Combine file uploads and URL-based media
    const media: MediaItem[] = [
      ...(file ? [{ file, url: undefined }] : []),
      ...(videoUrl ? [{ file: undefined, url: videoUrl }] : []),
    ];

    return this.tiktokService.post(accountId, createVideoDto, media);
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
    // @Query('days') days: number = 7,
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
