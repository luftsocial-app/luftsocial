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
import { FacebookPost } from './entity/facebook-post.entity';
import { FacebookPage } from './entity/facebook-page.entity';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ClerkAuthGuard } from 'src/guards/clerk-auth.guard';

@Controller('platforms/facebook')
@UseInterceptors(RateLimitInterceptor)
@UseGuards(ClerkAuthGuard)
export class FacebookController {
  constructor(private readonly facebookService: FacebookService) {}

  @Get('auth')
  async getAuthUrl(@CurrentUser() userId: string) {
    return { url: await this.facebookService.authorize(userId) };
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @CurrentUser() userId: string,
  ) {
    return this.facebookService.handleCallback(code, state, userId);
  }
  //    ======================================================================
  //    ================ FACEBOOK POSTS ======================================

  @Post(':accountId/posts')
  async createPost(
    @Param('accountId') accountId: string,
    @Body() body: { content: string; mediaUrls?: string[] },
  ) {
    return this.facebookService.post(accountId, body.content, body.mediaUrls);
  }

  @Get(':accountId/posts/:postId/comments')
  async getComments(
    @Param('accountId') accountId: string,
    @Param('postId') postId: string,
    @Query('pageToken') pageToken?: string,
  ) {
    return this.facebookService.getComments(accountId, postId, pageToken);
  }

  @Get(':accountId/posts/:postId/metrics')
  async getMetrics(
    @Param('accountId') accountId: string,
    @Param('postId') postId: string,
  ) {
    return this.facebookService.getMetrics(postId);
  }

  @Put('posts/:postId')
  async updatePost(
    @Param('postId') postId: string,
    @Body() updateDto: UpdatePostDto,
  ): Promise<FacebookPost> {
    return this.facebookService.editPost(postId, updateDto);
  }

  @Delete('posts/:postId')
  async deletePost(@Param('postId') postId: string): Promise<void> {
    return this.facebookService.deletePost(postId);
  }

  //    ======================================================================
  //    ================ FACEBOOK PAGES ======================================

  @Post('pages/:pageId/posts')
  async createPostForPage(
    @Param('pageId') pageId: string,
    @Body() createPostDto: CreatePostDto,
  ) {
    return this.facebookService.createPagePost(pageId, createPostDto);
  }

  @Post('posts/:postId/schedule')
  async schedulePost(
    @Param('pageId') pageId: string,
    @Body() schedulePostDto: SchedulePostDto,
  ) {
    return this.facebookService.schedulePost(pageId, schedulePostDto);
  }

  @Post('pages/:pageId/schedule')
  async schedulePagePost(
    @Param('pageId') pageId: string,
    @Body() scheduleDto: SchedulePagePostDto,
  ): Promise<FacebookPost> {
    scheduleDto.pageId = pageId;
    return this.facebookService.schedulePagePost(scheduleDto);
  }

  @Get('pages')
  async getPages(@CurrentUser() userId: string) {
    return this.facebookService.getUserPages(userId);
  }

  @Get('pages/:pageId/posts')
  async getPagePosts(
    @Param('pageId') pageId: string,
    @Query('limit') limit: number = 10,
    @Query('cursor') cursor?: string,
  ) {
    return this.facebookService.getPagePosts(pageId, limit, cursor);
  }

  @Get('pages/:pageId/insights')
  async getPageInsights(
    @Param('pageId') pageId: string,
    @Query('period') period: string = '30d',
  ) {
    return this.facebookService.getPageInsights(pageId, period);
  }

  @Get('posts/:postId/metrics')
  async getPostMetrics(@Param('postId') postId: string) {
    return this.facebookService.getPostMetrics(postId);
  }

  @Put('pages/:pageId')
  async updatePage(
    @Param('pageId') pageId: string,
    @Body() updateDto: UpdatePageDto,
  ): Promise<FacebookPage> {
    return this.facebookService.editPage(pageId, updateDto);
  }
}
