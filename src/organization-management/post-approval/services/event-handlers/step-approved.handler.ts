import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { AuditService } from 'src/audit/audit.service';
import { StepApprovedEvent } from '../../events/step-approved.event';

@EventsHandler(StepApprovedEvent)
export class StepApprovedHandler implements IEventHandler<StepApprovedEvent> {
  private readonly logger = new Logger(StepApprovedHandler.name);

  constructor(private readonly auditService: AuditService) {}

  async handle(event: StepApprovedEvent): Promise<void> {
    const { step, post, userId, comment } = event;

    // Log the event
    this.logger.log(
      `Approval step ${step.id} for post ${post.id} approved by user ${userId}`,
    );

    // Create audit log entry
    await this.auditService.recordAuditEvent({
      entityType: 'approval_step',
      entityId: step.id,
      action: 'approved',
      userId,
      organizationId: post.organizationId,
      tenantId: post.tenantId,
      metadata: {
        postId: post.id,
        stepName: step.name,
        comment: comment || '',
      },
    });

    // TODO: Notify post author about the approval
    // If post is now fully approved, notify managers
  }
}
