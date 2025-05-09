import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { Post, PostStatus } from '../entities/post.entity';
import { ApprovalStep } from '../entities/approval-step.entity';
import { CreatePostDto } from '../helper/dto/create-post.dto';
import { UpdatePostDto } from '../helper/dto/update-post.dto';
import { TaskService } from './task.service';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(ApprovalStep)
    private readonly approvalStepRepository: Repository<ApprovalStep>,
    private readonly taskService: TaskService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PostService.name);
  }

  async create(
    createPostDto: CreatePostDto,
    userId: string,
    teamId: string,
    tenantId: string,
  ): Promise<Post> {
    const post = this.postRepository.create({
      ...createPostDto,
      authorId: userId,
      teamId,
      tenantId,
      status: PostStatus.DRAFT,
    });

    return this.postRepository.save(post);
  }

  async findAll(teamId: string, tenantId: string): Promise<Post[]> {
    return this.postRepository.find({
      where: { teamId, tenantId },
      relations: ['author', 'approvalSteps'],
    });
  }

  async findOne(id: string, tenantId: string): Promise<Post> {
    const post = await this.postRepository.findOne({
      where: { id, tenantId },
      relations: [
        'author',
        'team',
        'approvalSteps',
        'approvalSteps.actions',
        'approvalSteps.actions.user',
      ],
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    return post;
  }

  async update(
    id: string,
    updatePostDto: UpdatePostDto,
    userId: string,
    tenantId: string,
  ): Promise<Post> {
    const post = await this.findOne(id, tenantId);

    // Only allow updates to draft posts or by luftSocial admins
    if (
      post.status !== PostStatus.DRAFT &&
      post.status !== PostStatus.REJECTED &&
      post.authorId !== userId
    ) {
      throw new ForbiddenException(
        'Cannot update a post that is in the approval process',
      );
    }

    Object.assign(post, updatePostDto);
    return this.postRepository.save(post);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const post = await this.findOne(id, tenantId);
    await this.postRepository.remove(post);
  }

  async submitForReview(
    id: string,
    userId: string,
    tenantId: string,
  ): Promise<Post> {
    const post = await this.findOne(id, tenantId);

    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'Only the author can submit a post for review',
      );
    }

    if (
      post.status !== PostStatus.DRAFT &&
      post.status !== PostStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Post is already in the approval process with status: ${post.status}`,
      );
    }

    // Update post status
    post.status = PostStatus.IN_REVIEW;
    await this.postRepository.save(post);

    // Create approval steps - typically would fetch from team configuration
    const steps = await this.createApprovalSteps(post);

    // Create task for the first approval step
    if (steps.length > 0) {
      await this.taskService.createReviewTask(post, steps[0]);
    }

    return this.findOne(id, tenantId);
  }

  // Helper method to create approval steps
  private async createApprovalSteps(post: Post): Promise<void> {
    // This would normally be configured per team
    // For simplicity, we'll create two steps:
    // 1. Reviewer approval
    // 2. Manager final approval

    const reviewStep = this.approvalStepRepository.create({
      name: 'Content Review',
      order: 1,
      requiredRole: 'reviewer',
      postId: post.id,
    });

    const approvalStep = this.approvalStepRepository.create({
      name: 'Final Approval',
      order: 2,
      requiredRole: 'manager',
      postId: post.id,
    });

    await this.approvalStepRepository.save([reviewStep, approvalStep]);
  }
}
