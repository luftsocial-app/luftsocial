import { Injectable } from '@nestjs/common';
import { createErrorResponse } from '../../decorators/socket-handler.decorator';
import {
  ParticipantActionPayload,
  RoomNameFactory,
  MessageEventType,
} from '../../events/message-events';
import {
  SocketWithUser,
  SocketResponse,
} from '../../interfaces/socket.interfaces';
import {
  validatePayload,
  createSuccessResponse,
} from '../../utils/response.utils';
import { ConversationService } from '../../../conversations/services/conversation.service';
import { PinoLogger } from 'nestjs-pino';
import { Server } from 'socket.io';

@Injectable()
export class ParticipantEventHandler {
  constructor(
    private conversationService: ConversationService,
    private readonly logger: PinoLogger,
  ) {
    // Initialize any dependencies or services here if needed
  }

  // Example method to handle a messaging event

  async participantAdded(
    client: SocketWithUser,
    payload: ParticipantActionPayload,
    server: Server,
  ): Promise<SocketResponse> {
    const { user } = client.data;

    // Validate payload
    const validationError = validatePayload(payload, [
      'conversationId',
      'participantIds',
    ]);
    if (validationError || !payload.participantIds.length) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Invalid participant data',
      );
    }

    // Add participants
    const conversation = await this.conversationService.addParticipantsToGroup(
      payload.conversationId,
      payload.participantIds,
      user.id,
    );

    // Notify existing participants
    const room = RoomNameFactory.conversationRoom(conversation.id);
    server.to(room).emit(MessageEventType.PARTICIPANTS_UPDATED, {
      conversationId: conversation.id,
      action: 'added',
      actorId: user.id,
      participants: payload.participantIds.map((id) => ({ id })),
      timestamp: new Date(),
    });

    // Add new participants to the conversation room
    for (const participantId of payload.participantIds) {
      const userRoom = RoomNameFactory.userRoom(participantId);
      server.to(userRoom).socketsJoin(room);
    }

    return createSuccessResponse({
      message: 'Participants added successfully',
    });
  }

  async participantRemoved(
    client: SocketWithUser,
    payload: ParticipantActionPayload,
    server: Server,
  ): Promise<SocketResponse> {
    const { user } = client.data;

    // Validate payload
    const validationError = validatePayload(payload, [
      'conversationId',
      'participantIds',
    ]);
    if (validationError || !payload.participantIds.length) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Invalid participant data',
      );
    }

    // Remove participants
    const conversation =
      await this.conversationService.removeParticipantsFromGroup(
        payload.conversationId,
        payload.participantIds,
        user.id,
      );

    this.logger.debug(
      `handleParticipantRemoved: Removed participants from conversation ${payload.conversationId} ${conversation.participants.map((p) => p.id).join(',')}`,
    );

    // Notify remaining participants about the removal
    const room = RoomNameFactory.conversationRoom(payload.conversationId);
    server.to(room).emit(MessageEventType.PARTICIPANTS_UPDATED, {
      conversationId: payload.conversationId,
      action: 'removed',
      actorId: user.id,
      participants: payload.participantIds.map((id) => ({ id })),
      timestamp: new Date(),
    });

    // Remove sockets of removed participants from the conversation room
    for (const participantId of payload.participantIds) {
      const userRoom = RoomNameFactory.userRoom(participantId);
      // Find all client sockets for this user and make them leave the room
      const socketsInRoom = await server.in(userRoom).fetchSockets();
      for (const socket of socketsInRoom) {
        socket.leave(room);
      }
    }

    return createSuccessResponse({
      message: 'Participants removed successfully',
    });
  }

  async joinConversation(
    client: SocketWithUser,
    conversationId: string,
  ): Promise<SocketResponse> {
    const { user } = client.data;

    const hasAccess = await this.conversationService.validateAccess(
      conversationId,
      user.id,
      user.tenantId,
    );

    if (hasAccess) {
      const room = RoomNameFactory.conversationRoom(conversationId);
      client.join(room);

      // Update participant's last active timestamp
      await this.conversationService.updateParticipantLastActive(
        user.id,
        conversationId,
      );

      return createSuccessResponse({
        conversationId,
        message: 'Joined conversation successfully',
      });
    } else {
      return createErrorResponse(
        'ACCESS_DENIED',
        'You do not have access to this conversation',
      );
    }
  }

  async leaveConversation(
    client: SocketWithUser,
    conversationId: string,
  ): Promise<SocketResponse> {
    const room = RoomNameFactory.conversationRoom(conversationId);
    client.leave(room);
    return createSuccessResponse({
      conversationId,
      message: 'Left conversation successfully',
    });
  }
}
