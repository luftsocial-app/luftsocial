import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { AuditService } from 'src/audit/audit.service';
import { PostSubmittedEvent } from '../../events/post-submitted.event';
import { TaskService } from '../task.service';

@EventsHandler(PostSubmittedEvent)
export class PostSubmittedHandler implements IEventHandler<PostSubmittedEvent> {
  private readonly logger = new Logger(PostSubmittedHandler.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly taskService: TaskService, // Add task service
  ) {}

  async handle(event: PostSubmittedEvent): Promise<void> {
    const { post, userId, approvalSteps, completedTaskId, associatedTasks } =
      event;

    try {
      // Log the event
      this.logger.log(`Post ${post.id} submitted for review by user ${userId}`);

      // If there's a specific task that was completed, mark it as completed
      if (completedTaskId) {
        await this.taskService.completeTask(completedTaskId, userId);
        this.logger.log(
          `Task ${completedTaskId} marked as completed for post ${post.id}`,
        );
      }

      // Create audit log entry
      await this.auditService.recordAuditEvent({
        entityType: 'post',
        entityId: post.id,
        action: 'submitted_for_review',
        userId,
        organizationId: post.organizationId,
        tenantId: post.tenantId,
        metadata: {
          approvalStepCount: approvalSteps.length,
          completedTaskId,
          associatedTasksCount: associatedTasks?.length || 0,
          taskIds: associatedTasks,
        },
      });

      // Log task completion audit if applicable
      if (completedTaskId) {
        await this.auditService.recordAuditEvent({
          entityType: 'task',
          entityId: completedTaskId,
          action: 'completed_via_post_submission',
          userId,
          organizationId: post.organizationId,
          tenantId: post.tenantId,
          metadata: {
            postId: post.id,
            postTitle: post.title,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle post submitted event for post ${post.id}`,
        error,
      );
      // Don't throw error to prevent blocking the main workflow
    }
  }
}
