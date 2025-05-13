import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { AuditService } from 'src/audit/audit.service';
import { PostSubmittedEvent } from '../../events/post-submitted.event';

@EventsHandler(PostSubmittedEvent)
export class PostSubmittedHandler implements IEventHandler<PostSubmittedEvent> {
  private readonly logger = new Logger(PostSubmittedHandler.name);

  constructor(private readonly auditService: AuditService) {}

  async handle(event: PostSubmittedEvent): Promise<void> {
    const { post, userId, approvalSteps } = event;

    // Log the event
    this.logger.log(`Post ${post.id} submitted for review by user ${userId}`);

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
      },
    });

    // TODO: Notify reviewers of the first step
  }
}
