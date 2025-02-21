import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { ChatService } from '../chat/chat.service';
import { WsGuard } from '../../guards/ws.guard';

interface MessagePayload {
  conversationId: string;
  content: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@UseGuards(WsGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  async handleConnection(client: Socket) {
    const user = client.data.user;
    client.join(`user_${user.id}`);

    // Join all user's conversation rooms
    const conversations = await this.chatService.getConversationsByUserId(
      user.id,
    );
    conversations.forEach((conv) => {
      client.join(`conversation_${conv.id}`);
    });
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user;
    if (user) {
      client.leave(`user_${user.id}`);
    }
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(client: Socket, payload: MessagePayload) {
    const user = client.data.user;

    // Validate access
    const hasAccess = await this.chatService.validateAccess(
      payload.conversationId,
      user.id,
      user.tenantId,
    );

    if (!hasAccess) {
      return { error: 'Access denied to this conversation' };
    }

    // Save message
    const message = await this.chatService.createMessage(
      payload.conversationId,
      payload.content,
      user.id,
    );

    // Get conversation to ensure we have all participants
    const conversation = await this.chatService.getConversation(
      payload.conversationId,
    );

    // Emit to all participants in the conversation
    this.server.to(`conversation_${conversation.id}`).emit('newMessage', {
      id: message.id,
      conversationId: conversation.id,
      sender: user,
      content: payload.content,
      createdAt: message.createdAt,
    });

    return { success: true, messageId: message.id };
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(client: Socket, conversationId: string) {
    const user = client.data.user;

    const hasAccess = await this.chatService.validateAccess(
      conversationId,
      user.id,
      user.tenantId,
    );

    if (hasAccess) {
      client.join(`conversation_${conversationId}`);
      return { success: true };
    }

    return { error: 'Access denied to this conversation' };
  }

  @SubscribeMessage('leaveConversation')
  async handleLeaveConversation(client: Socket, conversationId: string) {
    client.leave(`conversation_${conversationId}`);
    return { success: true };
  }

  @SubscribeMessage('typing')
  async handleTyping(client: Socket, conversationId: string) {
    const user = client.data.user;

    this.server.to(`conversation_${conversationId}`).emit('userTyping', {
      conversationId,
      user: {
        id: user.id,
        name: user.username,
      },
    });
  }

  @SubscribeMessage('stopTyping')
  async handleStopTyping(client: Socket, conversationId: string) {
    const user = client.data.user;

    this.server.to(`conversation_${conversationId}`).emit('userStoppedTyping', {
      conversationId,
      userId: user.id,
    });
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    client: Socket,
    payload: { messageId: string; conversationId: string },
  ): Promise<void> {
    const user = client.data.user;
    await this.chatService.markMessageAsRead(payload.messageId, user.id);

    // Notify other participants
    this.server
      .to(`conversation_${payload.conversationId}`)
      .emit('messageRead', {
        messageId: payload.messageId,
        userId: user.id,
        readAt: new Date(),
      });
  }
}
