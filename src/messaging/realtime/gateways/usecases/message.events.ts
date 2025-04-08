import { Injectable } from '@nestjs/common';
import { createErrorResponse } from '../../decorators/socket-handler.decorator';
import {
  ReactionPayload,
  RoomNameFactory,
  MessageEventType,
} from '../../events/message-events';
import {
  SocketWithUser,
  SocketResponse,
} from '../../interfaces/socket.interfaces';
import { createSuccessResponse } from '../../utils/response.utils';
import { MessageValidatorService } from '../../services/message-validator.service';
import { MessageService } from '../../../messages/services/message.service';
import { Server } from 'socket.io';

@Injectable()
export class MessageEventHandler {
  constructor(
    private readonly messageValidatorService: MessageValidatorService,
    private readonly messageService: MessageService,
  ) {}

  async handleReactionRemoved(
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

  async handleReactionAdded(
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

    // Add reaction to message
    const message = await this.messageService.addReaction(
      payload.messageId,
      user.id,
      payload.emoji,
    );

    // Notify participants about the reaction
    const room = RoomNameFactory.conversationRoom(message.conversationId);
    server.to(room).emit(MessageEventType.REACTION_ADDED, {
      messageId: message.id,
      userId: user.id,
      username: user.username,
      emoji: payload.emoji,
      timestamp: new Date(),
    });

    return createSuccessResponse();
  }
}
