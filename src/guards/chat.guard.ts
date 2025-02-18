import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ChatService } from '../messaging/chat/chat.service';

@Injectable()
export class ChatGuard implements CanActivate {
  constructor(private chatService: ChatService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const conversationId = request.params.conversationId;
    const userId = request.user.id;
    const tenantId = request.tenantId;

    return this.chatService.validateAccess(conversationId, userId, tenantId);
  }
}
