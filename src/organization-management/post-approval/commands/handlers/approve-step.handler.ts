import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApproveStepCommand } from '../approve-step.command';
import { TaskService } from '../../services/task.service';
import { StepApprovedEvent } from '../../events/step-approved.event';
import {
  ApprovalAction,
  ApprovalActionType,
} from '../../entities/approval-action.entity';
import {
  ApprovalStep,
  ApprovalStepStatus,
} from '../../entities/approval-step.entity';
import { UserPost, PostStatus } from '../../entities/post.entity';

@CommandHandler(ApproveStepCommand)
export class ApproveStepHandler implements ICommandHandler<ApproveStepCommand> {
  private readonly logger = new Logger(ApproveStepHandler.name);

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

  async execute(command: ApproveStepCommand): Promise<ApprovalStep> {
    const { postId, stepId, approvePostDto, userId, userRole, tenantId } =
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

    // Use transaction for atomic operations
    return this.dataSource.transaction(async (entityManager) => {
      // Record approval action
      const approvalAction = entityManager.create(ApprovalAction, {
        action: ApprovalActionType.APPROVE,
        comment: approvePostDto.comment,
        approvalStepId: stepId,
        userId,
      });

      await entityManager.save(ApprovalAction, approvalAction);

      // Update step status
      step.status = ApprovalStepStatus.APPROVED;
      const updatedStep = await entityManager.save(ApprovalStep, step);

      // Complete the task for this step
      await this.taskService.completeTaskForStep(stepId, userId, entityManager);

      // Check if all steps are approved
      const allSteps = await entityManager.find(ApprovalStep, {
        where: { postId },
        order: { order: 'ASC' },
      });

      const allApproved = allSteps.every(
        (s) => s.status === ApprovalStepStatus.APPROVED,
      );

      if (allApproved) {
        // Update post status to approved
        post.status = PostStatus.APPROVED;
        await entityManager.save(UserPost, post);

        // Create a publish task for managers
        await this.taskService.createPublishTask(post, entityManager);
      } else {
        // Find the next pending step
        const nextStep = allSteps.find(
          (s) => s.status === ApprovalStepStatus.PENDING,
        );

        if (nextStep) {
          // Create task for the next step
          await this.taskService.createReviewTask(
            post,
            nextStep,
            entityManager,
          );
        }
      }

      // Publish event
      this.eventBus.publish(
        new StepApprovedEvent(
          updatedStep,
          post,
          userId,
          approvePostDto.comment,
        ),
      );

      return this.approvalStepRepository.findOne({
        where: { id: stepId },
        relations: ['actions'],
      });
    });
  }
}
