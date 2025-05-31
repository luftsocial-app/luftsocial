import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { RejectStepCommand } from '../reject-step.command';
import {
  ApprovalStep,
  ApprovalStepStatus,
} from '../../entities/approval-step.entity';
import {
  ApprovalAction,
  ApprovalActionType,
} from '../../entities/approval-action.entity';
import { TaskService } from '../../services/task.service';
import { UserPost, PostStatus } from '../../entities/post.entity';
import { StepRejectedEvent } from '../../events/step-rejected.event';

@CommandHandler(RejectStepCommand)
export class RejectStepHandler implements ICommandHandler<RejectStepCommand> {
  private readonly logger = new Logger(RejectStepHandler.name);

  constructor(
    @InjectRepository(UserPost)
    private readonly postRepository: Repository<UserPost>,
    @InjectRepository(ApprovalStep)
    private readonly approvalStepRepository: Repository<ApprovalStep>,
    @InjectRepository(ApprovalAction)
    private readonly approvalActionRepository: Repository<ApprovalAction>,
    private readonly taskService: TaskService,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RejectStepCommand): Promise<ApprovalStep> {
    const { postId, stepId, rejectPostDto, userId, userRole, tenantId } =
      command;

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

    // Require rejection comment
    if (!rejectPostDto.comment) {
      throw new BadRequestException(
        'Comment is required when rejecting a post',
      );
    }

    // Use transaction for atomic operations
    return this.dataSource.transaction(async (entityManager) => {
      // Record rejection action
      const rejectionAction = entityManager.create(ApprovalAction, {
        action: ApprovalActionType.REJECT,
        comment: rejectPostDto.comment,
        approvalStepId: stepId,
        userId,
      });

      await entityManager.save(ApprovalAction, rejectionAction);

      // Update step status
      step.status = ApprovalStepStatus.REJECTED;
      const updatedStep = await entityManager.save(ApprovalStep, step);

      // Update post status
      post.status = PostStatus.REJECTED;
      await entityManager.save(UserPost, post);

      // Complete current task and cancel all pending tasks
      await this.taskService.completeTaskForStep(stepId, userId, entityManager);
      await this.taskService.cancelTasksByPost(postId, entityManager);

      // Publish event
      this.eventBus.publish(
        new StepRejectedEvent(updatedStep, post, userId, rejectPostDto.comment),
      );

      return this.approvalStepRepository.findOne({
        where: { id: stepId },
        relations: ['actions'],
      });
    });
  }
}
