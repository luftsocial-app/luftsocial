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
  CreateFacebookPagePostDto,
  UpdatePageDto,
  UpdatePostDto,
} from './helpers/post.dto';
import { RateLimitInterceptor } from './helpers/rate-limit.interceptor';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express/multer';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { FacebookPage } from '../entities/facebook-entities/facebook-page.entity';
import { FacebookPost } from '../entities/facebook-entities/facebook-post.entity';

@Controller('platforms/facebook')
@UseInterceptors(RateLimitInterceptor)
@UseGuards(ClerkAuthGuard)
export class FacebookController {
  constructor(private readonly facebookService: FacebookService) {}

  @Post('pages/:pageId/posts')
  @UseInterceptors(FilesInterceptor('files'))
  async createPostForPage(
    @Param('pageId') pageId: string,
    @Body() createPostDto: CreateFacebookPagePostDto,
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

  @Post('pages/:pageId/schedule')
  @UseInterceptors(FilesInterceptor('files'))
  async schedulePagePost(
    @Param('pageId') pageId: string,
    @Body() scheduleDto: CreateFacebookPagePostDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (files?.length) {
      scheduleDto.media = scheduleDto.media || [];
      files.forEach((file) => {
        scheduleDto.media.push({ file });
      });
    }

    return this.facebookService.schedulePagePost(pageId, scheduleDto);
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
