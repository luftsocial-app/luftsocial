import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { SubmitPostForReviewCommand } from '../submit-post-for-review.command';

import { TaskService } from '../../services/task.service';
import { PostSubmittedEvent } from '../../events/post-submitted.event';
import { WorkflowTemplate } from '../../entities/workflow-template.entity';
import {
  ApprovalStep,
  ApprovalStepStatus,
} from '../../entities/approval-step.entity';
import { UserPost, PostStatus } from '../../entities/post.entity';

@CommandHandler(SubmitPostForReviewCommand)
export class SubmitPostForReviewHandler
  implements ICommandHandler<SubmitPostForReviewCommand>
{
  private readonly logger = new Logger(SubmitPostForReviewHandler.name);

  constructor(
    @InjectRepository(UserPost)
    private readonly postRepository: Repository<UserPost>,
    @InjectRepository(ApprovalStep)
    private readonly approvalStepRepository: Repository<ApprovalStep>,
    @InjectRepository(WorkflowTemplate)
    private readonly workflowTemplateRepository: Repository<WorkflowTemplate>,
    private readonly taskService: TaskService,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: SubmitPostForReviewCommand): Promise<UserPost> {
    const { postId, userId, tenantId } = command;

    // Fetch post with necessary relations
    const post = await this.postRepository.findOne({
      where: { id: postId, tenantId },
      relations: ['organization', 'organization.workflowTemplates'],
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    // Validate authorship
    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'Only the author can submit a post for review',
      );
    }

    // Validate state transition
    const validStates = [PostStatus.DRAFT, PostStatus.REJECTED];
    if (!validStates.includes(post.status)) {
      throw new BadRequestException(
        `Post cannot be submitted for review from its current status: ${post.status}`,
      );
    }

    // Use transaction for atomic operations
    return this.dataSource.transaction(async (entityManager) => {
      // Update post status
      post.status = PostStatus.IN_REVIEW;
      post.submittedAt = new Date();

      const updatedPost = await entityManager.save(UserPost, post);

      // Initialize workflow steps
      const steps = await this.initializeWorkflow(updatedPost, entityManager);

      // Create task for first approval step
      if (steps.length > 0) {
        await this.taskService.createReviewTask(
          updatedPost,
          steps[0],
          entityManager,
        );
      }

      // Publish event
      this.eventBus.publish(new PostSubmittedEvent(updatedPost, userId, steps));

      // Return updated post with approval steps
      return this.postRepository.findOne({
        where: { id: postId },
        relations: ['approvalSteps', 'approvalSteps.actions'],
      });
    });
  }

  private async initializeWorkflow(
    post: UserPost,
    entityManager,
  ): Promise<ApprovalStep[]> {
    try {
      // Try to get organization workflow template
      let workflowTemplate: WorkflowTemplate = null;

      // if (post.organization?.workflowTemplates?.length > 0) {
      //   workflowTemplate = post.organization.workflowTemplates.find(
      //     (t) => t.isActive,
      //   );
      // }

      // If no organization template, get default template
      if (!workflowTemplate) {
        workflowTemplate = await this.workflowTemplateRepository.findOne({
          where: { isDefault: true },
          relations: ['steps'],
          order: { steps: { order: 'ASC' } },
        });
      }

      // If we found a template with steps, create approval steps from it
      if (workflowTemplate?.steps?.length > 0) {
        const steps = workflowTemplate.steps.map((templateStep) =>
          entityManager.create(ApprovalStep, {
            name: templateStep.name,
            description: templateStep.description,
            order: templateStep.order,
            requiredRole: templateStep.requiredRole,
            status: ApprovalStepStatus.PENDING,
            postId: post.id,
            templateStepId: templateStep.id,
            estimatedCompletionTime: templateStep.estimatedTimeInHours,
          }),
        );

        return entityManager.save(ApprovalStep, steps);
      }

      // Fall back to default steps if no template available
      this.logger.warn(
        `No workflow template found for post ${post.id}. Using default steps.`,
      );
      return this.createDefaultSteps(post.id, entityManager);
    } catch (error) {
      this.logger.error(
        `Error creating approval workflow: ${error.message}`,
        error.stack,
      );
      return this.createDefaultSteps(post.id, entityManager);
    }
  }

  private async createDefaultSteps(
    postId: string,
    entityManager,
  ): Promise<ApprovalStep[]> {
    const steps = [
      entityManager.create(ApprovalStep, {
        name: 'Content Review',
        description: 'Review content for accuracy, quality and brand alignment',
        order: 1,
        requiredRole: 'reviewer',
        status: ApprovalStepStatus.PENDING,
        postId,
      }),
      entityManager.create(ApprovalStep, {
        name: 'Final Approval',
        description: 'Final approval and publishing authorization',
        order: 2,
        requiredRole: 'manager',
        status: ApprovalStepStatus.PENDING,
        postId,
      }),
    ];

    return entityManager.save(ApprovalStep, steps);
  }
}
