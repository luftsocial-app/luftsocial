// src/platforms/instagram/controllers/instagram.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseInterceptors,
} from '@nestjs/common';
import { InstagramErrorInterceptor } from './interceptors/instagram-error.interceptor';
import { InstagramService } from './instagram.service';
import { RateLimitInterceptor } from './interceptors/rate-limit.interceptor';
import { CreatePostDto, CreateStoryDto } from './helpers/create-content.dto';

@Controller('platforms/instagram')
@UseInterceptors(InstagramErrorInterceptor, RateLimitInterceptor)
export class InstagramController {
  constructor(private readonly instagramService: InstagramService) {}

  @Post(':accountId/media')
  async createPost(
    @Param('accountId') accountId: string,
    @Body() createPostDto: CreatePostDto,
  ) {
    return this.instagramService.post(
      accountId,
      createPostDto.caption,
      createPostDto.mediaUrls,
    );
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
