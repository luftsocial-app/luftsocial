import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PostPublishedEvent } from '../../events/post-published.event';
import { AuditService } from 'src/audit/audit.service';

@EventsHandler(PostPublishedEvent)
export class PostPublishedHandler implements IEventHandler<PostPublishedEvent> {
  private readonly logger = new Logger(PostPublishedHandler.name);

  constructor(private readonly auditService: AuditService) {}

  async handle(event: PostPublishedEvent): Promise<void> {
    const { post, userId, platforms, publishId } = event;

    // Log the event
    this.logger.log(
      `Post ${post.id} published by user ${userId} to platforms: ${platforms.join(', ')}`,
    );

    // Create audit log entry
    await this.auditService.recordAuditEvent({
      entityType: 'post',
      entityId: post.id,
      action: 'published',
      userId,
      organizationId: post.organizationId,
      tenantId: post.tenantId,
      metadata: {
        platforms,
        publishId,
      },
    });
    // TODO: Add logic to notify post author and organization members about the publication
    // Notify post author and organization members about the publication

    // TODO: Initialize analytics tracking
  }
}
