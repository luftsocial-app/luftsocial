import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ChatService } from '../messaging/chat/chat.service';

@Injectable()
export class ChatGuard implements CanActivate {
  constructor(private chatService: ChatService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const conversationId = request.params.id;

    // If no conversation ID in params, allow (might be creating new conversation)
    if (!conversationId) {
      return true;
    }

    // Check if user has access to the conversation
    return this.chatService.validateAccess(
      conversationId,
      user.id,
      user.tenantId,
    );
  }
}
