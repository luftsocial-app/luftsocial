import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { StepRejectedEvent } from '../../events/step-rejected.event';
import { AuditService } from 'src/audit/audit.service';

@EventsHandler(StepRejectedEvent)
export class StepRejectedHandler implements IEventHandler<StepRejectedEvent> {
  private readonly logger = new Logger(StepRejectedHandler.name);

  constructor(private readonly auditService: AuditService) {}

  async handle(event: StepRejectedEvent): Promise<void> {
    const { step, post, userId, comment } = event;

    // Log the event
    this.logger.log(
      `Approval step ${step.id} for post ${post.id} rejected by user ${userId}`,
    );

    // Create audit log entry
    await this.auditService.recordAuditEvent({
      entityType: 'approval_step',
      entityId: step.id,
      action: 'rejected',
      userId,
      organizationId: post.organizationId,
      tenantId: post.tenantId,
      metadata: {
        postId: post.id,
        stepName: step.name,
        comment,
      },
    });

    // TODO: Notify post author about the rejection
    // Notify post author about the rejection goes here
  }
}
