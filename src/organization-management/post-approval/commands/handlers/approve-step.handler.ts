import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
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

  async execute(command: ApproveStepCommand): Promise<ApprovalStep[]> {
    const { postId, stepIds, approvePostDto, userId, userRole, tenantId } =
      command;

    // Handle backward compatibility - if stepId is provided, convert to array
    const stepsToApprove = Array.isArray(stepIds) ? stepIds : [stepIds];

    // Find post and approval steps
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

    // Find all steps to approve
    const steps = await this.approvalStepRepository.find({
      where: {
        id: In(stepsToApprove),
        postId,
      },
    });

    if (steps.length !== stepsToApprove.length) {
      throw new NotFoundException(`Some approval steps not found`);
    }

    // Check permissions for each step
    for (const step of steps) {
      if (step.requiredRole !== userRole) {
        throw new ForbiddenException(
          `Only users with role '${step.requiredRole}' can approve step ${step.id}`,
        );
      }

      if (step.status !== ApprovalStepStatus.PENDING) {
        throw new BadRequestException(
          `Step ${step.name} has already been ${step.status}`,
        );
      }
    }

    // Use transaction for atomic operations
    return this.dataSource.transaction(async (entityManager) => {
      try {
        const updatedSteps: ApprovalStep[] = [];

        // Process each step
        for (const stepId of stepsToApprove) {
          this.logger.log(`Processing approval for step ${stepId}`);

          // Record approval action
          const approvalAction = entityManager.create(ApprovalAction, {
            action: ApprovalActionType.APPROVE,
            comment: approvePostDto.comment,
            approvalStepId: stepId,
            userId,
          });

          await entityManager.save(ApprovalAction, approvalAction);
          this.logger.log(`Approval action created for step ${stepId}`);

          // Update step status
          await entityManager.update(
            ApprovalStep,
            { id: stepId },
            { status: ApprovalStepStatus.APPROVED },
          );
          this.logger.log(`Step ${stepId} status updated to APPROVED`);

          // Complete the task for this step
          await this.taskService.completeTaskForStep(
            stepId,
            userId,
            entityManager,
          );

          // Get updated step for response
          const updatedStep = await entityManager.findOne(ApprovalStep, {
            where: { id: stepId },
            relations: ['actions'],
          });
          updatedSteps.push(updatedStep);
        }

        // Get fresh data for all steps to check if all are approved
        const allSteps = await entityManager.find(ApprovalStep, {
          where: { postId },
          order: { order: 'ASC' },
        });

        this.logger.log(`Found ${allSteps.length} steps for post ${postId}`);
        allSteps.forEach((s) => {
          this.logger.log(
            `Step ${s.id} (order: ${s.order}) status: ${s.status}`,
          );
        });

        const allApproved = allSteps.every(
          (s) => s.status === ApprovalStepStatus.APPROVED,
        );

        this.logger.log(`All steps approved: ${allApproved}`);

        let currentPost = post;

        if (allApproved) {
          this.logger.log(
            `All steps approved - updating post ${postId} to APPROVED status`,
          );

          // Update post status
          await entityManager.update(
            UserPost,
            { id: postId },
            { status: PostStatus.APPROVED },
          );

          // Get updated post
          currentPost = await entityManager.findOne(UserPost, {
            where: { id: postId },
          });

          this.logger.log(`Post ${postId} final status: ${currentPost.status}`);

          // Create publish task
          await this.taskService.createPublishTask(currentPost, entityManager);
        } else {
          // Find the next pending step
          const nextStep = allSteps.find(
            (s) => s.status === ApprovalStepStatus.PENDING,
          );

          if (nextStep) {
            this.logger.log(`Creating task for next step: ${nextStep.id}`);
            await this.taskService.createReviewTask(
              currentPost,
              nextStep,
              entityManager,
            );
          }
        }

        // Publish events for each approved step
        for (const updatedStep of updatedSteps) {
          this.eventBus.publish(
            new StepApprovedEvent(
              updatedStep,
              currentPost,
              userId,
              approvePostDto.comment,
            ),
          );
        }

        return updatedSteps;
      } catch (error) {
        this.logger.error(
          `Error in approval transaction: ${error.message}`,
          error.stack,
        );
        throw error;
      }
    });
  }
}
