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
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiResponse,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { OrganizationAccessGuard } from 'src/guards/organization-access.guard';
import { RoleGuard } from 'src/guards/role-guard';
import { CreateDraftPostCommand } from '../commands/create-draft-post.command';
import { SubmitPostForReviewCommand } from '../commands/submit-post-for-review.command';
import { PostStatus } from '../entities/post.entity';
import { CreateDraftPostDto } from '../helper/dto/create-draft-post.dto';
import { PostResponseDto } from '../helper/dto/post-response.dto';
import { GetorganizationPostsQuery } from '../queries/get-team-posts.query';
import { GetPostDetailsQuery } from '../queries/get-post-details.query';

@ApiTags('Post Workflow')
@Controller('posts')
@UseGuards(RoleGuard, OrganizationAccessGuard)
export class PostWorkflowController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('drafts')
  @ApiOperation({ summary: 'Create a draft post' })
  @ApiConsumes('multipart/form-data')
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

    // Execute command to create draft
    const command = new CreateDraftPostCommand(
      createDraftDto,
      user.id,
      organizationId,
      user.tenantId,
      files,
    );

    const post = await this.commandBus.execute(command);
    return new PostResponseDto(post);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit a post for review' })
  @ApiResponse({ status: 200, type: PostResponseDto })
  @UseGuards(OrganizationAccessGuard)
  async submitForReview(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<PostResponseDto> {
    // Execute command
    const command = new SubmitPostForReviewCommand(id, user.id, user.tenantId);
    const post = await this.commandBus.execute(command);
    return new PostResponseDto(post);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get post details' })
  @ApiResponse({ status: 200, type: PostResponseDto })
  async getPostDetails(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<PostResponseDto> {
    // Execute query
    const query = new GetPostDetailsQuery(id, user.tenantId);
    return this.queryBus.execute(query);
  }

  @Get()
  @ApiOperation({ summary: 'Get organization posts' })
  async getorganizationPosts(
    @Query('organizationId') organizationId: string,
    @Query('status') status: PostStatus,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @CurrentUser() user: any,
  ): Promise<{ posts: PostResponseDto[]; total: number }> {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }

    // Execute query
    const query = new GetorganizationPostsQuery(
      organizationId,
      user.tenantId,
      status,
      page,
      limit,
    );

    return this.queryBus.execute(query);
  }
}
