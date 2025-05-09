import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
} from '@nestjs/common';
import { PostService } from '../services/post.service';
import { Post as PostEntity } from '../entities/post.entity';
import { CreatePostDto } from '../helper/dto/create-post.dto';
import { UpdatePostDto } from '../helper/dto/update-post.dto';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  async create(
    @Body() createPostDto: CreatePostDto,
    @Request() req,
  ): Promise<PostEntity> {
    const { userId, teamId } = req.user;
    const tenantId = req.tenantId;

    return this.postService.create(createPostDto, userId, teamId, tenantId);
  }

  @Get()
  async findAll(@Request() req): Promise<PostEntity[]> {
    const { teamId } = req.user;
    const tenantId = req.tenantId;

    return this.postService.findAll(teamId, tenantId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req): Promise<PostEntity> {
    const tenantId = req.tenantId;

    return this.postService.findOne(id, tenantId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
    @Request() req,
  ): Promise<PostEntity> {
    const { userId } = req.user;
    const tenantId = req.tenantId;

    return this.postService.update(id, updatePostDto, userId, tenantId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req): Promise<void> {
    const tenantId = req.tenantId;

    return this.postService.remove(id, tenantId);
  }

  @Post(':id/submit')
  async submitForReview(
    @Param('id') id: string,
    @Request() req,
  ): Promise<PostEntity> {
    const { userId } = req.user;
    const tenantId = req.tenantId;

    return this.postService.submitForReview(id, userId, tenantId);
  }
}
