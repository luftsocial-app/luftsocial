// src/platforms/linkedin/controllers/linkedin.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseInterceptors,
} from '@nestjs/common';
import { LinkedInService } from './linkedin.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { LinkedInErrorInterceptor } from './helpers/linkedin-error.interceptor';
import { CreateLinkedInPostDto } from './helpers/create-post.dto';

@Controller('platforms/linkedin')
@UseInterceptors(LinkedInErrorInterceptor)
export class LinkedInController {
  constructor(private readonly linkedInService: LinkedInService) {}

  @Post(':accountId/posts')
  async createPost(
    @Param('accountId') accountId: string,
    @Body() createPostDto: CreateLinkedInPostDto,
  ) {
    return this.linkedInService.post(
      accountId,
      createPostDto.content,
      createPostDto.mediaUrls,
    );
  }

  @Get('auth')
  async getAuthUrl(@CurrentUser() userId: string) {
    const url = await this.linkedInService.authorize(userId);
    return { url };
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @CurrentUser() userId: string,
  ) {
    return this.linkedInService.handleCallback(code, userId);
  }

  @Get(':accountId/posts/:postId/comments')
  async getComments(
    @Param('accountId') accountId: string,
    @Param('postId') postId: string,
    @Query('pageToken') pageToken?: string,
  ) {
    return this.linkedInService.getComments(accountId, postId, pageToken);
  }

  @Get(':accountId/posts/:postId/metrics')
  async getMetrics(
    @Param('accountId') accountId: string,
    @Param('postId') postId: string,
  ) {
    return this.linkedInService.getPostMetrics(accountId, postId);
  }

  @Get(':accountId/organizations')
  async getUserOrganizations(@Param('accountId') accountId: string) {
    return this.linkedInService.getUserOrganizations(accountId);
  }
}
