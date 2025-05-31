import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseInterceptors,
  UploadedFiles,
  UsePipes,
  ValidationPipe,
  BadRequestException,
  Query,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { OrganizationAccessGuard } from '../../../guards/organization-access.guard';
import { RoleGuard } from '../../../guards/role-guard';
import { CreateDraftPostCommand } from '../commands/create-draft-post.command';
import { SubmitPostForReviewCommand } from '../commands/submit-post-for-review.command';
import { PublishPostCommand } from '../commands/publish-post.command';
import { RejectStepCommand } from '../commands/reject-step.command';
import { PostStatus } from '../entities/post.entity';
import { CreateDraftPostDto } from '../helper/dto/create-draft-post.dto';
import { PostResponseDto } from '../helper/dto/post-response.dto';
import { PublishPostDto } from '../helper/dto/publish-post.dto';
import { RejectPostDto } from '../helper/dto/reject-post.dto';
import { GetorganizationPostsQuery } from '../queries/get-team-posts.query';
import { GetPostDetailsQuery } from '../queries/get-post-details.query';
import { TenantService } from '../../../user-management/tenant.service';

@ApiTags('Post Workflow')
@Controller('posts')
@UseGuards(RoleGuard, OrganizationAccessGuard)
export class PostWorkflowController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly tenantService: TenantService,
  ) {}

  @Post('drafts')
  @ApiOperation({ summary: 'Create a draft post for a specific task' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'taskId',
    required: true,
    description: 'Task ID that this post is created for',
  })
  @ApiQuery({
    name: 'organizationId',
    required: true,
    description: 'Organization ID',
  })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    }),
  )
  @UsePipes(new ValidationPipe({ transform: true }))
  @UseGuards(OrganizationAccessGuard)
  async createDraft(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() createDraftDto: CreateDraftPostDto,
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ): Promise<PostResponseDto> {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }

    if (!createDraftDto.taskId) {
      throw new BadRequestException('taskId query parameter is required');
    }

    // Execute command to create draft post for specific task
    const command = new CreateDraftPostCommand(
      createDraftDto,
      user.userId,
      organizationId,
      organizationId,
      createDraftDto.taskId, // Link to specific task
      files,
    );

    const post = await this.commandBus.execute(command);
    return new PostResponseDto(post);
  }

  @Post(':id/submit')
  @ApiOperation({
    summary: 'Submit a post for review (completes associated task)',
  })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, type: PostResponseDto })
  @UseGuards(OrganizationAccessGuard)
  async submitForReview(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<PostResponseDto> {
    // Execute command - this will also update the associated task status
    const tenantId = this.tenantService.getTenantId();

    const command = new SubmitPostForReviewCommand(id, user.userId, tenantId);
    const post = await this.commandBus.execute(command);
    return new PostResponseDto(post);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish a post (completes publish task)' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  @ApiResponse({ status: 200, type: PostResponseDto })
  @UseGuards(OrganizationAccessGuard)
  async publishPost(
    @Param('id') id: string,
    @Body() publishPostDto: PublishPostDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: any,
  ): Promise<PostResponseDto> {
    const tenantId = this.tenantService.getTenantId();

    const command = new PublishPostCommand(
      id,
      publishPostDto,
      user.userId,
      user.orgRole || 'member',
      tenantId,
      files,
    );

    const post = await this.commandBus.execute(command);
    return new PostResponseDto(post);
  }

  @Patch(':id/reject/:stepId')
  @ApiOperation({ summary: 'Reject a post at specific approval step' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiParam({ name: 'stepId', description: 'Approval Step ID' })
  @ApiResponse({ status: 200, type: PostResponseDto })
  @UseGuards(OrganizationAccessGuard)
  async rejectPost(
    @Param('id') id: string,
    @Param('stepId') stepId: string,
    @Body() rejectPostDto: RejectPostDto,
    @CurrentUser() user: any,
  ): Promise<PostResponseDto> {
    const tenantId = this.tenantService.getTenantId();

    const command = new RejectStepCommand(
      id,
      stepId,
      rejectPostDto,
      user.userId,
      user.role || 'member',
      tenantId,
    );

    const post = await this.commandBus.execute(command);
    return new PostResponseDto(post);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get post details with associated tasks' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, type: PostResponseDto })
  async getPostDetails(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<PostResponseDto> {
    const tenantId = this.tenantService.getTenantId();

    const query = new GetPostDetailsQuery(id, tenantId);
    return this.queryBus.execute(query);
  }

  @Get()
  @ApiOperation({ summary: 'Get organization posts with task information' })
  @ApiQuery({
    name: 'organizationId',
    required: true,
    description: 'Organization ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: PostStatus,
    description: 'Filter by post status',
  })
  @ApiQuery({
    name: 'taskId',
    required: false,
    description: 'Filter by specific task ID',
  })
  @ApiQuery({
    name: 'assignedToMe',
    required: false,
    type: Boolean,
    description: 'Show only posts with tasks assigned to current user',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  async getOrganizationPosts(
    @Query('organizationId') organizationId: string,
    @Query('status') status: PostStatus,
    @Query('taskId') taskId: string,
    @Query('assignedToMe') assignedToMe: boolean,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @CurrentUser() user: any,
  ): Promise<{ posts: PostResponseDto[]; total: number; taskSummary?: any }> {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }

    const tenantId = this.tenantService.getTenantId();
    // Execute query with task filtering
    const query = new GetorganizationPostsQuery(
      organizationId,
      tenantId,
      status,
      page,
      limit,
      taskId,
      assignedToMe ? user.userId : undefined,
    );

    return this.queryBus.execute(query);
  }

  @Get('tasks/:taskId/posts')
  @ApiOperation({ summary: 'Get all posts created for a specific task' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiQuery({
    name: 'organizationId',
    required: true,
    description: 'Organization ID',
  })
  async getPostsForTask(
    @Param('taskId') taskId: string,
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ): Promise<{ posts: PostResponseDto[]; taskInfo?: any }> {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }
    const tenantId = this.tenantService.getTenantId();

    const query = new GetorganizationPostsQuery(
      organizationId,
      tenantId,
      undefined, // status
      1, // page
      100, // limit
      taskId, // specific task ID
    );

    return this.queryBus.execute(query);
  }

  @Get('my-assigned')
  @ApiOperation({ summary: 'Get posts where current user has assigned tasks' })
  @ApiQuery({
    name: 'organizationId',
    required: true,
    description: 'Organization ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: PostStatus,
    description: 'Filter by post status',
  })
  @ApiQuery({
    name: 'taskStatus',
    required: false,
    description: 'Filter by task status (pending, completed, canceled)',
  })
  async getMyAssignedPosts(
    @Query('organizationId') organizationId: string,
    @Query('status') status: PostStatus,
    @Query('taskStatus') taskStatus: string,
    @CurrentUser() user: any,
  ): Promise<{ posts: PostResponseDto[]; workloadSummary?: any }> {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }
    const tenantId = this.tenantService.getTenantId();

    const query = new GetorganizationPostsQuery(
      organizationId,
      tenantId,
      status,
      1,
      100,
      undefined, // taskId
      user.userId, // assignedToUserId
      taskStatus,
    );

    return this.queryBus.execute(query);
  }

  @Get(':id/task-progress')
  @ApiOperation({ summary: 'Get task progress for a specific post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  async getPostTaskProgress(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<{
    postId: string;
    taskSummary: any;
    canPublish: boolean;
    nextActions: string[];
  }> {
    const tenantId = this.tenantService.getTenantId();

    // This would return task progress information for the post
    const query = new GetPostDetailsQuery(id, tenantId);
    const result = await this.queryBus.execute(query);

    return {
      postId: id,
      taskSummary: result.taskSummary,
      canPublish: result.canPublish,
      nextActions: result.nextActions || [],
    };
  }
}
