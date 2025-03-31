import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UseGuards,
  UploadedFiles,
} from '@nestjs/common';
import { FacebookService } from './facebook.service';
import {
  CreatePostDto,
  SchedulePagePostDto,
  SchedulePostDto,
  UpdatePageDto,
  UpdatePostDto,
} from './helpers/post.dto';
import { RateLimitInterceptor } from './helpers/rate-limit.interceptor';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express/multer';
import { MediaItem } from '../platform-service.interface';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { FacebookPage } from '../../entities/socials/facebook-entities/facebook-page.entity';
import { FacebookPost } from '../../entities/socials/facebook-entities/facebook-post.entity';

@Controller('platforms/facebook')
@UseInterceptors(RateLimitInterceptor)
@UseGuards(ClerkAuthGuard)
export class FacebookController {
  constructor(private readonly facebookService: FacebookService) {}

  @Post(':accountId/posts')
  @UseInterceptors(FilesInterceptor('files'))
  async createPost(
    @Param('accountId') accountId: string,
    @Body('content') content: string,
    @Body('mediaUrls') mediaUrls?: string[],
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    // Combine file uploads and URL-based media
    const media: MediaItem[] = [
      ...(files?.map((file) => ({ file, url: undefined })) || []),
      ...(mediaUrls?.map((url) => ({ url, file: undefined })) || []),
    ];

    return this.facebookService.post(accountId, content, media);
  }

  @Post('pages/:pageId/posts')
  @UseInterceptors(FilesInterceptor('files'))
  async createPostForPage(
    @Param('pageId') pageId: string,
    @Body() createPostDto: CreatePostDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (files?.length) {
      createPostDto.media = createPostDto.media || [];
      files.forEach((file) => {
        createPostDto.media.push({ file });
      });
    }

    return this.facebookService.createPagePost(pageId, createPostDto);
  }

  @Post(':accountId/posts/schedule')
  @UseInterceptors(FilesInterceptor('files'))
  async schedulePost(
    @Param('accountId') accountId: string,
    @Body() schedulePostDto: SchedulePostDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    if (files?.length) {
      schedulePostDto.media = schedulePostDto.media || [];
      files.forEach((file) => {
        schedulePostDto.media.push({ file });
      });
    }

    return this.facebookService.schedulePost(accountId, schedulePostDto);
  }

  @Post('pages/:pageId/schedule')
  @UseInterceptors(FilesInterceptor('files'))
  async schedulePagePost(
    @Param('pageId') pageId: string,
    @Body() scheduleDto: SchedulePagePostDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (files?.length) {
      scheduleDto.media = scheduleDto.media || [];
      files.forEach((file) => {
        scheduleDto.media.push({ file });
      });
    }

    return this.facebookService.schedulePagePost(scheduleDto);
  }

  @Get(':accountId/posts/:postId/comments')
  async getComments(
    @CurrentUser() user: any,
    @Param('postId') postId: string,
    @Query('pageToken') pageToken?: string,
  ) {
    const { userId: accountId } = user;
    return this.facebookService.getComments(accountId, postId, pageToken);
  }

  @Get('pages')
  async getPages(@CurrentUser() user) {
    return this.facebookService.getUserPages(user.userId);
  }

  @Get('pages/:pageId/posts')
  async getPagePosts(
    @Param('pageId') pageId: string,
    @Query('limit') limit: number = 10,
    @Query('cursor') cursor?: string,
  ) {
    return this.facebookService.getPagePosts(pageId, limit, cursor);
  }

  // Still need to test
  @Get('pages/:pageId/insights')
  async getPageInsights(
    @Param('pageId') pageId: string,
    @Query('period') period: string = 'days_28',
    @Query('metrics') metrics?: string,
  ) {
    return this.facebookService.getPageInsights(pageId, period, metrics);
  }

  @Get('posts/:accountId/:postId/metrics')
  async getPostMetrics(
    @Param('accountId') accountId: string,
    @Param('postId') postId: string,
  ) {
    return this.facebookService.getPostMetrics(accountId, postId);
  }

  @Put('posts/:postId')
  @UseInterceptors(FilesInterceptor('files'))
  async updatePost(
    @Param('postId') postId: string,
    @Body() updateDto: UpdatePostDto,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<FacebookPost> {
    // Associate uploaded files with media in DTO
    if (files?.length) {
      updateDto.media = updateDto.media || [];
      files.forEach((file) => {
        updateDto.media.push({ file });
      });
    }
    return this.facebookService.editPost(postId, updateDto);
  }

  @Put('pages/:pageId')
  async updatePage(
    @Param('pageId') pageId: string,
    @Body() updateDto: UpdatePageDto,
  ): Promise<FacebookPage> {
    return this.facebookService.editPage(pageId, updateDto);
  }

  @Delete('posts/:postId')
  async deletePost(@Param('postId') postId: string): Promise<void> {
    return this.facebookService.deletePost(postId);
  }
}
