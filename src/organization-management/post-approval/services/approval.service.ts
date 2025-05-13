import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { UserPost, PostStatus } from '../entities/post.entity';
import {
  ApprovalStep,
  ApprovalStepStatus,
} from '../entities/approval-step.entity';
import {
  ApprovalAction,
  ApprovalActionType,
} from '../entities/approval-action.entity';
import { ApprovePostDto } from '../helper/dto/approve-post.dto';
import { RejectPostDto } from '../helper/dto/reject-post.dto';
import { TaskService } from './task.service';
import { Task, TaskStatus } from '../entities/task.entity';

@Injectable()
export class ApprovalService {
  constructor(
    @InjectRepository(UserPost)
    private readonly postRepository: Repository<UserPost>,
    @InjectRepository(ApprovalStep)
    private readonly approvalStepRepository: Repository<ApprovalStep>,
    @InjectRepository(ApprovalAction)
    private readonly approvalActionRepository: Repository<ApprovalAction>,
    @InjectRepository(ApprovalAction)
    private readonly taskRepository: Repository<Task>,
    private readonly taskService: TaskService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ApprovalService.name);
  }

  private async checkAllStepsCompletedAndCreateNextTask(
    post: UserPost,
  ): Promise<void> {
    const steps = await this.approvalStepRepository.find({
      where: { postId: post.id },
      order: { order: 'ASC' },
    });

    // Check if all steps are approved
    const allApproved = steps.every(
      (step) => step.status === ApprovalStepStatus.APPROVED,
    );

    if (allApproved) {
      // Update post status to approved
      post.status = PostStatus.APPROVED;
      await this.postRepository.save(post);

      // Create a publish task for managers
      await this.taskService.createPublishTask(post);
    } else {
      // Find the next pending step
      const nextStep = steps.find(
        (step) => step.status === ApprovalStepStatus.PENDING,
      );

      if (nextStep) {
        // Create task for the next step
        await this.taskService.createReviewTask(post, nextStep);
      }
    }
  }
  private async completeTaskForStep(
    stepId: string,
    userId: string,
  ): Promise<void> {
    // Find task for this step and mark as completed
    const tasks = await this.taskRepository.find({
      where: {
        approvalStepId: stepId,
        status: TaskStatus.PENDING,
      },
    });

    for (const task of tasks) {
      await this.taskService.completeTask(task.id, userId);
    }
  }

  async approveStep(
    postId: string,
    stepId: string,
    approvePostDto: ApprovePostDto,
    userId: string,
    userRole: string,
    tenantId: string,
  ): Promise<UserPost> {
    const { comment } = approvePostDto;

    // Find post and approval step
    const post = await this.postRepository.findOne({
      where: { id: postId, tenantId },
      relations: ['approvalSteps'],
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    if (post.status !== PostStatus.IN_REVIEW) {
      throw new BadRequestException(
        `Post is not in review state, current status: ${post.status}`,
      );
    }

    const step = await this.approvalStepRepository.findOne({
      where: { id: stepId, postId },
    });

    if (!step) {
      throw new NotFoundException(`Approval step with ID ${stepId} not found`);
    }

    // Check if user has permission to approve this step
    if (step.requiredRole !== userRole) {
      throw new ForbiddenException(
        `Only users with role '${step.requiredRole}' can approve this step`,
      );
    }

    if (step.status !== ApprovalStepStatus.PENDING) {
      throw new BadRequestException(
        `This step has already been ${step.status}`,
      );
    }

    // Record approval action
    const approvalAction = this.approvalActionRepository.create({
      action: ApprovalActionType.APPROVE,
      comment,
      approvalStepId: stepId,
      userId,
    });

    await this.approvalActionRepository.save(approvalAction);

    // Update step status
    step.status = ApprovalStepStatus.APPROVED;
    await this.approvalStepRepository.save(step);

    // Mark current task as completed
    await this.completeTaskForStep(stepId, userId);

    // Check if all steps are approved and create next task if needed
    await this.checkAllStepsCompletedAndCreateNextTask(post);

    return this.postRepository.findOne({
      where: { id: postId },
      relations: ['approvalSteps', 'approvalSteps.actions'],
    });
  }

  async rejectStep(
    postId: string,
    stepId: string,
    rejectPostDto: RejectPostDto,
    userId: string,
    userRole: string,
    tenantId: string,
  ): Promise<UserPost> {
    const { comment } = rejectPostDto;

    if (!comment) {
      throw new BadRequestException(
        'Comment is required when rejecting a post',
      );
    }

    // Find post and approval step
    const post = await this.postRepository.findOne({
      where: { id: postId, tenantId },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    if (post.status !== PostStatus.IN_REVIEW) {
      throw new BadRequestException(
        `Post is not in review state, current status: ${post.status}`,
      );
    }

    const step = await this.approvalStepRepository.findOne({
      where: { id: stepId, postId },
    });

    if (!step) {
      throw new NotFoundException(`Approval step with ID ${stepId} not found`);
    }

    // Check if user has permission to reject this step
    if (step.requiredRole !== userRole) {
      throw new ForbiddenException(
        `Only users with role '${step.requiredRole}' can reject this step`,
      );
    }

    if (step.status !== ApprovalStepStatus.PENDING) {
      throw new BadRequestException(
        `This step has already been ${step.status}`,
      );
    }

    // Record rejection action
    const approvalAction = this.approvalActionRepository.create({
      action: ApprovalActionType.REJECT,
      comment,
      approvalStepId: stepId,
      userId,
    });

    await this.approvalActionRepository.save(approvalAction);

    // Mark current task as completed
    await this.completeTaskForStep(stepId, userId);

    // Cancel any pending tasks for this post
    await this.taskService.cancelTasksByPost(postId);

    // Update step status
    step.status = ApprovalStepStatus.REJECTED;
    await this.approvalStepRepository.save(step);

    // Update post status
    post.status = PostStatus.REJECTED;
    await this.postRepository.save(post);

    return this.postRepository.findOne({
      where: { id: postId },
      relations: ['approvalSteps', 'approvalSteps.actions'],
    });
  }

  async publishPost(
    postId: string,
    userId: string,
    userRole: string,
    tenantId: string,
  ): Promise<UserPost> {
    const post = await this.postRepository.findOne({
      where: { id: postId, tenantId },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    if (post.status !== PostStatus.APPROVED) {
      throw new BadRequestException(
        `Post must be approved before publishing, current status: ${post.status}`,
      );
    }

    // Check if user has permission to publish posts
    if (userRole !== 'manager') {
      throw new ForbiddenException('Only managers can publish posts');
    }

    // Here you would integrate with your social media publishing API
    // For now, we'll just update the status
    post.status = PostStatus.PUBLISHED;
    return this.postRepository.save(post);
  }

  async schedulePost(
    postId: string,
    scheduledDate: Date,
    userId: string,
    userRole: string,
    tenantId: string,
  ): Promise<UserPost> {
    const post = await this.postRepository.findOne({
      where: { id: postId, tenantId },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    if (post.status !== PostStatus.APPROVED) {
      throw new BadRequestException(
        `Post must be approved before scheduling, current status: ${post.status}`,
      );
    }

    // Check if user has permission to schedule posts
    if (userRole !== 'manager') {
      throw new ForbiddenException('Only managers can schedule posts');
    }

    // Validate scheduled date is in the future
    if (scheduledDate <= new Date()) {
      throw new BadRequestException('Scheduled date must be in the future');
    }

    post.scheduledFor = scheduledDate;
    post.status = PostStatus.SCHEDULED;
    return this.postRepository.save(post);
  }

  // Helper method to check if all steps are approved
  private async checkAllStepsCompleted(postId: string): Promise<void> {
    const steps = await this.approvalStepRepository.find({
      where: { postId },
    });

    const allApproved = steps.every(
      (step) => step.status === ApprovalStepStatus.APPROVED,
    );

    if (allApproved) {
      const post = await this.postRepository.findOneBy({ id: postId });
      post.status = PostStatus.APPROVED;
      await this.postRepository.save(post);
    }
  }
}
