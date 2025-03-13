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
import { LinkedInService } from './linkedin.service';
import { LinkedInErrorInterceptor } from './helpers/linkedin-error.interceptor';
import { CreateLinkedInPostDto } from './helpers/create-post.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MediaItem } from '../platform-service.interface';

@Controller('platforms/linkedin')
@UseInterceptors(LinkedInErrorInterceptor)
export class LinkedInController {
  constructor(private readonly linkedInService: LinkedInService) {}

  @Post(':accountId/posts')
  @UseInterceptors(FilesInterceptor('files'))
  async createPost(
    @Param('accountId') accountId: string,
    @Body() createPostDto: CreateLinkedInPostDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    // Combine file uploads and URL-based media
    const media: MediaItem[] = [
      ...(files?.map((file) => ({ file, url: undefined })) || []),
      ...(createPostDto.mediaUrls?.map((url) => ({ url, file: undefined })) ||
        []),
    ];

    return this.linkedInService.post(accountId, createPostDto, media);
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
