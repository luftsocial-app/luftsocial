import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ConversationService } from '../messaging/conversations/services/conversation.service';

@Injectable()
export class ChatGuard implements CanActivate {
  constructor(private conversationService: ConversationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const conversationId = request.params.id;

    // If no conversation ID in params, allow (might be creating new conversation)
    if (!conversationId) {
      return true;
    }

    // Check if user has access to the conversation
    return this.conversationService.validateAccess(
      conversationId,
      user.id,
      user.tenantId,
    );
  }
}
