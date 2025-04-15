import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { InstagramErrorInterceptor } from './interceptors/instagram-error.interceptor';
import { InstagramService } from './instagram.service';
import { RateLimitInterceptor } from './interceptors/rate-limit.interceptor';
import {
  CreateInstagramPostDto,
  CreateStoryDto,
} from './helpers/create-content.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MediaItem } from '../platform-service.interface';

@Controller('platforms/instagram')
@UseInterceptors(InstagramErrorInterceptor, RateLimitInterceptor)
export class InstagramController {
  constructor(private readonly instagramService: InstagramService) {}

  @Post(':accountId/media')
  @UseInterceptors(FilesInterceptor('files'))
  async createPost(
    @Param('accountId') accountId: string,
    @Body() createPostDto: CreateInstagramPostDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    // Combine file uploads and URL-based media
    const media: MediaItem[] = [
      ...(files?.map((file) => ({ file, url: undefined })) || []),
      ...(createPostDto.mediaUrls?.map((url) => ({ url, file: undefined })) ||
        []),
    ];

    return this.instagramService.post(accountId, createPostDto, media);
  }

  @Post(':accountId/stories')
  async createStory(
    @Param('accountId') accountId: string,
    @Body() createStoryDto: CreateStoryDto,
  ) {
    return this.instagramService.createStory(
      accountId,
      createStoryDto.mediaUrl,
      createStoryDto.stickers,
    );
  }

  @Get(':accountId/media/:mediaId/comments')
  async getComments(
    @Param('accountId') accountId: string,
    @Param('mediaId') mediaId: string,
    @Query('pageToken') pageToken?: string,
  ) {
    return this.instagramService.getComments(accountId, mediaId, pageToken);
  }

  @Get(':accountId/media/:mediaId/metrics')
  async getMetrics(
    @Param('accountId') accountId: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.instagramService.getPostMetrics(accountId, mediaId);
  }

  @Get(':accountId/insights')
  async getAccountInsights(@Param('accountId') accountId: string) {
    return this.instagramService.getAccountInsights(accountId);
  }
}
