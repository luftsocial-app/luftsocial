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
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { CreatePostDto, CreateStoryDto } from './helpers/create-content.dto';

@Controller('platforms/instagram')
@UseInterceptors(InstagramErrorInterceptor, RateLimitInterceptor)
export class InstagramController {
  constructor(private readonly instagramService: InstagramService) {}

  @Get('auth')
  async getAuthUrl(@CurrentUser() userId: string) {
    return { url: await this.instagramService.authorize(userId) };
  }

  @Get('callback')
  async handleCallback(@Query('code') code: string) {
    return this.instagramService.handleCallback(code);
  }

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
    return this.instagramService.getMetrics(accountId, mediaId);
  }

  @Get(':accountId/insights')
  async getAccountInsights(@Param('accountId') accountId: string) {
    return this.instagramService.getAccountInsights(accountId);
  }
}
