import { Injectable } from '@nestjs/common';
import { createErrorResponse } from '../../decorators/socket-handler.decorator';
import {
  ReactionPayload,
  RoomNameFactory,
  MessageEventType,
  TypingEventPayload,
  ReadReceiptPayload,
} from '../../events/message-events';
import {
  SocketWithUser,
  SocketResponse,
} from '../../interfaces/socket.interfaces';
import {
  createSuccessResponse,
  validatePayload,
} from '../../utils/response.utils';
import { MessageValidatorService } from '../../services/message-validator.service';
import { MessageService } from '../../../messages/services/message.service';
import { Server } from 'socket.io';
import { WebsocketHelpers } from '../../utils/websocket.helpers';

@Injectable()
export class MessageEventHandler {
  constructor(
    private readonly messageValidatorService: MessageValidatorService,
    private readonly messageService: MessageService,
    private readonly websocketHelpers: WebsocketHelpers,
  ) {}

  async reactionRemoved(
    client: SocketWithUser,
    payload: ReactionPayload,
    server: Server,
  ): Promise<SocketResponse> {
    const { user } = client.data;

    // Validate reaction payload
    const validationError =
      this.messageValidatorService.validateReaction(payload);
    if (validationError) {
      return createErrorResponse('VALIDATION_ERROR', validationError);
    }

    // Remove reaction from message
    const message = await this.messageService.removeReaction(
      payload.messageId,
      user.id,
      payload.emoji,
    );

    console.log({ message });

    // Notify participants about the reaction removal
    const room = RoomNameFactory.conversationRoom(message.conversationId);
    server.to(room).emit(MessageEventType.REACTION_REMOVED, {
      messageId: message.id,
      userId: user.id,
      emoji: payload.emoji,
      timestamp: new Date(),
    });

    return createSuccessResponse();
  }

  async reactionAdded(
    client: SocketWithUser,
    payload: ReactionPayload,
    server: Server,
  ): Promise<SocketResponse> {
    const { user } = client.data;

    // Validate reaction payload
    const validationError =
      this.messageValidatorService.validateReaction(payload);

    console.log({ validationError });

    if (validationError) {
      return createErrorResponse('VALIDATION_ERROR', validationError);
    }

    // Add reaction to message
    const message = await this.messageService.addReaction(
      payload.messageId,
      user.id,
      payload.emoji,
    );

    console.log({ message });

    // Notify participants about the reaction
    const room = RoomNameFactory.conversationRoom(message.conversationId);
    console.log({ room });

    server.to(room).emit(MessageEventType.REACTION_ADDED, {
      messageId: message.id,
      userId: user.id,
      username: user.username,
      emoji: payload.emoji,
      timestamp: new Date(),
    });

    return createSuccessResponse();
  }

  async handleTyping(
    client: SocketWithUser,
    payload: TypingEventPayload,
    server: Server,
  ): Promise<SocketResponse> {
    const { user } = client.data;

    // Validate payload
    const validationError = validatePayload(payload, ['conversationId']);
    if (validationError) {
      return createErrorResponse('VALIDATION_ERROR', validationError);
    }

    // Rate limiting for typing events
    const throttleKey = `typing:${user.id}:${payload.conversationId}`;
    if (this.websocketHelpers.isThrottled(throttleKey)) {
      // Silently ignore rate-limited typing events but return success
      // Typing indicators are non-critical and shouldn't error for UX reasons
      return createSuccessResponse({ throttled: true });
    }

    const room = RoomNameFactory.conversationRoom(payload.conversationId);
    server.to(room).emit(MessageEventType.USER_TYPING, {
      conversationId: payload.conversationId,
      user: {
        id: user.id,
        username: user.username,
      },
      timestamp: new Date(),
    });

    return createSuccessResponse();
  }

  async stopTyping(
    client: SocketWithUser,
    payload: TypingEventPayload,
    server: Server,
  ): Promise<SocketResponse> {
    const { user } = client.data;

    // Validate payload
    const validationError = validatePayload(payload, ['conversationId']);
    if (validationError) {
      return createErrorResponse('VALIDATION_ERROR', validationError);
    }

    const room = RoomNameFactory.conversationRoom(payload.conversationId);
    server.to(room).emit(MessageEventType.USER_STOPPED_TYPING, {
      conversationId: payload.conversationId,
      userId: user.id,
      timestamp: new Date(),
    });

    return createSuccessResponse();
  }

  async markAsRead(
    client: SocketWithUser,
    payload: ReadReceiptPayload,
    server: Server,
  ): Promise<SocketResponse> {
    const { user } = client.data;

    // Validate payload
    const validationError = validatePayload(payload, [
      'messageId',
      'conversationId',
    ]);
    if (validationError) {
      return createErrorResponse('VALIDATION_ERROR', validationError);
    }

    // Rate limiting for read receipts
    const throttleKey = `read:${user.id}:${payload.messageId}`;
    if (this.websocketHelpers.isThrottled(throttleKey)) {
      // Return success but don't process - this is a high frequency event
      return createSuccessResponse({ throttled: true });
    }

    await this.messageService.markMessageAsRead(payload.messageId, user.id);

    // Notify other participants
    const room = RoomNameFactory.conversationRoom(payload.conversationId);
    server.to(room).emit(MessageEventType.MESSAGE_READ, {
      messageId: payload.messageId,
      userId: user.id,
      conversationId: payload.conversationId,
      readAt: new Date(),
    });

    return createSuccessResponse();
  }
}
