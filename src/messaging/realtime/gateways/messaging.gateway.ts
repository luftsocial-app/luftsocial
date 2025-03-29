// External dependencies
import { Logger, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server } from 'socket.io';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';

// Internal services
import { ConversationService } from '../../conversations/services/conversation.service';
import { MessageService } from '../../messages/services/message.service';
import { MessageValidatorService } from '../services/message-validator.service';

// Guards
import { WsGuard } from '../../../guards/ws.guard';

// Events and payloads
import {
  ErrorEvent,
  MessageDeletePayload,
  MessageEventPayload,
  MessageEventType,
  MessageUpdatePayload,
  ParticipantActionPayload,
  ReactionPayload,
  ReadReceiptPayload,
  RoomNameFactory,
  TypingEventPayload,
} from '../events/message-events';

// Interfaces and types
import {
  SocketResponse,
  SocketWithUser,
} from '../interfaces/socket.interfaces';

// Utils and decorators
import { SocketHandler } from '../decorators/socket-handler.decorator';
import {
  createErrorResponse,
  createSuccessResponse,
  validatePayload,
} from '../utils/response.utils';

@WebSocketGateway({
  cors: {
    origin: '*', // In production, specify exact origins
  },
  namespace: 'messaging',
  transports: ['websocket', 'polling'],
})
@UseGuards(WsGuard)
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagingGateway.name);
  private readonly throttleTimers = new Map<string, number>();
  private readonly MESSAGE_THROTTLE_MS: number;
  private readonly TYPING_THROTTLE_MS: number;
  private readonly READ_RECEIPT_THROTTLE_MS: number;
  private readonly MAX_CLIENTS_PER_USER: number;
  private readonly clientsPerUser = new Map<string, Set<string>>();

  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly messageValidator: MessageValidatorService,
    private readonly configService: ConfigService,
  ) {
    this.MESSAGE_THROTTLE_MS = this.configService.get<number>(
      'messaging.throttle.messageRateMs',
      500,
    );
    this.TYPING_THROTTLE_MS = this.configService.get<number>(
      'messaging.throttle.typingRateMs',
      2000,
    );
    this.READ_RECEIPT_THROTTLE_MS = this.configService.get<number>(
      'messaging.throttle.readReceiptRateMs',
      1000,
    );
    this.MAX_CLIENTS_PER_USER = this.configService.get<number>(
      'messaging.maxClientsPerUser',
      5,
    );
  }

  afterInit() {
    console.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: SocketWithUser) {
    try {
      const { user } = client.data;
      if (!user) {
        client.disconnect();
        return;
      }

      // Add to user's client set
      if (!this.clientsPerUser.has(user.id)) {
        this.clientsPerUser.set(user.id, new Set());
      }

      const userClients = this.clientsPerUser.get(user.id);
      userClients.add(client.id);

      // Check if too many clients for this user
      if (userClients.size > this.MAX_CLIENTS_PER_USER) {
        client.emit(MessageEventType.ERROR, {
          code: 'TOO_MANY_CONNECTIONS',
          message: `Maximum of ${this.MAX_CLIENTS_PER_USER} connections allowed`,
        });
        client.disconnect();
        return;
      }

      // Join user's room (for user-specific events)
      const userRoom = RoomNameFactory.userRoom(user.id);
      client.join(userRoom);

      // Get user's conversations and join their rooms
      const conversations =
        await this.conversationService.getConversationsByUserId(user.id);

      for (const conversation of conversations) {
        const room = RoomNameFactory.conversationRoom(conversation.id);
        client.join(room);
      }

      this.logger.debug(
        `Client connected: ${client.id} (User: ${user.id}, ${user.username})`,
      );
    } catch (error) {
      this.logger.error(
        `Error in handleConnection: ${error.message}`,
        error.stack,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: SocketWithUser) {
    try {
      const { user } = client.data;
      if (user && this.clientsPerUser.has(user.id)) {
        const userClients = this.clientsPerUser.get(user.id);
        userClients.delete(client.id);
        if (userClients.size === 0) {
          this.clientsPerUser.delete(user.id);
        }
      }
      this.logger.debug(`Client disconnected: ${client.id}`);
    } catch (error) {
      this.logger.error(
        `Error in handleDisconnect: ${error.message}`,
        error.stack,
      );
    }
  }

  private isThrottled(key: string, throttleTimeMs: number): boolean {
    const now = Date.now();
    const lastTime = this.throttleTimers.get(key) || 0;

    if (now - lastTime < throttleTimeMs) {
      return true;
    }

    this.throttleTimers.set(key, now);
    return false;
  }

  private handleError(client: SocketWithUser, errorEvent: ErrorEvent): void {
    client.emit(MessageEventType.ERROR, errorEvent);
  }

  @SubscribeMessage(MessageEventType.SEND_MESSAGE)
  @SocketHandler()
  async handleMessage(
    client: SocketWithUser,
    payload: MessageEventPayload,
  ): Promise<SocketResponse> {
    const { user } = client.data;

    // Rate limiting
    const throttleKey = `message:${user.id}`;
    if (this.isThrottled(throttleKey, this.MESSAGE_THROTTLE_MS)) {
      return createErrorResponse(
        'RATE_LIMITED',
        'You are sending messages too quickly',
      );
    }

    // Validate payload
    const validationError = this.messageValidator.validateNewMessage(payload);
    if (validationError) {
      return createErrorResponse('VALIDATION_ERROR', validationError);
    }

    // Validate access
    const hasAccess = await this.conversationService.validateAccess(
      payload.conversationId,
      user.id,
      user.tenantId,
    );

    if (!hasAccess) {
      return createErrorResponse(
        'ACCESS_DENIED',
        'You do not have access to this conversation',
      );
    }

    // Save message
    const message = await this.messageService.createMessage(
      payload.conversationId,
      payload.content,
      user.id,
    );

    // Get conversation to ensure we have all participants
    const conversation = await this.conversationService.getConversation(
      payload.conversationId,
    );

    // Emit to all participants in the conversation
    const room = RoomNameFactory.conversationRoom(conversation.id);
    this.server.to(room).emit(MessageEventType.MESSAGE_CREATED, {
      id: message.id,
      conversationId: conversation.id,
      sender: {
        id: user.id,
        username: user.username,
        // Include other sender info that's useful for the client
      },
      content: payload.content,
      createdAt: message.createdAt,
      parentMessageId: payload.parentMessageId,
    });

    return createSuccessResponse({
      messageId: message.id,
      timestamp: message.createdAt,
    });
  }

  @SubscribeMessage(MessageEventType.JOIN_CONVERSATION)
  @SocketHandler()
  async handleJoinConversation(
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

  @SubscribeMessage(MessageEventType.PARTICIPANT_ADD)
  @SocketHandler()
  async handleParticipantAdded(
    client: SocketWithUser,
    payload: ParticipantActionPayload,
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
    this.server.to(room).emit(MessageEventType.PARTICIPANTS_UPDATED, {
      conversationId: conversation.id,
      action: 'added',
      actorId: user.id,
      participants: payload.participantIds.map((id) => ({ id })),
      timestamp: new Date(),
    });

    // Add new participants to the conversation room
    for (const participantId of payload.participantIds) {
      const userRoom = RoomNameFactory.userRoom(participantId);
      this.server.to(userRoom).socketsJoin(room);
    }

    return createSuccessResponse({
      message: 'Participants added successfully',
    });
  }

  @SubscribeMessage(MessageEventType.PARTICIPANT_REMOVE)
  @SocketHandler()
  async handleParticipantRemoved(
    client: SocketWithUser,
    payload: ParticipantActionPayload,
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
    this.server.to(room).emit(MessageEventType.PARTICIPANTS_UPDATED, {
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
      const socketsInRoom = await this.server.in(userRoom).fetchSockets();
      for (const socket of socketsInRoom) {
        socket.leave(room);
      }
    }

    return createSuccessResponse({
      message: 'Participants removed successfully',
    });
  }

  @SubscribeMessage(MessageEventType.LEAVE_CONVERSATION)
  @SocketHandler()
  async handleLeaveConversation(
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

  @SubscribeMessage(MessageEventType.TYPING_START)
  @SocketHandler()
  async handleTyping(
    client: SocketWithUser,
    payload: TypingEventPayload,
  ): Promise<SocketResponse> {
    const { user } = client.data;

    // Validate payload
    const validationError = validatePayload(payload, ['conversationId']);
    if (validationError) {
      return createErrorResponse('VALIDATION_ERROR', validationError);
    }

    // Rate limiting for typing events
    const throttleKey = `typing:${user.id}:${payload.conversationId}`;
    if (this.isThrottled(throttleKey, this.TYPING_THROTTLE_MS)) {
      // Silently ignore rate-limited typing events but return success
      // Typing indicators are non-critical and shouldn't error for UX reasons
      return createSuccessResponse({ throttled: true });
    }

    const room = RoomNameFactory.conversationRoom(payload.conversationId);
    this.server.to(room).emit(MessageEventType.USER_TYPING, {
      conversationId: payload.conversationId,
      user: {
        id: user.id,
        username: user.username,
      },
      timestamp: new Date(),
    });

    return createSuccessResponse();
  }

  @SubscribeMessage(MessageEventType.TYPING_STOP)
  @SocketHandler()
  async handleStopTyping(
    client: SocketWithUser,
    payload: TypingEventPayload,
  ): Promise<SocketResponse> {
    const { user } = client.data;

    // Validate payload
    const validationError = validatePayload(payload, ['conversationId']);
    if (validationError) {
      return createErrorResponse('VALIDATION_ERROR', validationError);
    }

    const room = RoomNameFactory.conversationRoom(payload.conversationId);
    this.server.to(room).emit(MessageEventType.USER_STOPPED_TYPING, {
      conversationId: payload.conversationId,
      userId: user.id,
      timestamp: new Date(),
    });

    return createSuccessResponse();
  }

  @SubscribeMessage(MessageEventType.MARK_AS_READ)
  @SocketHandler()
  async handleMarkAsRead(
    client: SocketWithUser,
    payload: ReadReceiptPayload,
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
    if (this.isThrottled(throttleKey, this.READ_RECEIPT_THROTTLE_MS)) {
      // Return success but don't process - this is a high frequency event
      return createSuccessResponse({ throttled: true });
    }

    await this.messageService.markMessageAsRead(payload.messageId, user.id);

    // Notify other participants
    const room = RoomNameFactory.conversationRoom(payload.conversationId);
    this.server.to(room).emit(MessageEventType.MESSAGE_READ, {
      messageId: payload.messageId,
      userId: user.id,
      conversationId: payload.conversationId,
      readAt: new Date(),
    });

    return createSuccessResponse();
  }

  @SubscribeMessage(MessageEventType.UPDATE_MESSAGE)
  @SocketHandler()
  async handleMessageUpdated(
    client: SocketWithUser,
    payload: MessageUpdatePayload,
  ): Promise<SocketResponse> {
    const { user } = client.data;

    // Validate update payload
    const validationError =
      this.messageValidator.validateMessageUpdate(payload);
    if (validationError) {
      return createErrorResponse('VALIDATION_ERROR', validationError);
    }

    // Update message
    const message = await this.messageService.updateMessage(
      payload.messageId,
      { content: payload.content },
      user.id,
    );

    // Notify other participants about the update
    const room = RoomNameFactory.conversationRoom(message.conversationId);
    this.server.to(room).emit(MessageEventType.MESSAGE_UPDATED, {
      id: message.id,
      conversationId: message.conversationId,
      content: message.content,
      updatedAt: message.updatedAt,
      isEdited: message.isEdited,
      editVersion: message.metadata?.editHistory?.length || 1,
    });

    return createSuccessResponse({
      messageId: message.id,
      updatedAt: message.updatedAt,
    });
  }

  @SubscribeMessage(MessageEventType.DELETE_MESSAGE)
  @SocketHandler()
  async handleMessageDeleted(
    client: SocketWithUser,
    payload: MessageDeletePayload,
  ): Promise<SocketResponse> {
    const { user } = client.data;

    // Validate payload
    const validationError = validatePayload(payload, ['messageId']);
    if (validationError) {
      return createErrorResponse('VALIDATION_ERROR', validationError);
    }

    // Get message before deletion to know conversation ID
    const message = await this.messageService.findMessageById(
      payload.messageId,
      user.tenantId,
    );

    if (!message) {
      return createErrorResponse('NOT_FOUND', 'Message not found');
    }

    const conversationId = message.conversationId;

    // Delete message
    await this.messageService.deleteMessage(payload.messageId, user.id);

    // Broadcast deletion to all participants
    const room = RoomNameFactory.conversationRoom(conversationId);
    this.server.to(room).emit(MessageEventType.MESSAGE_DELETED, {
      id: payload.messageId,
      conversationId,
      deletedBy: user.id,
      deletedAt: new Date(),
    });

    return createSuccessResponse({
      messageId: payload.messageId,
      conversationId,
    });
  }

  @SubscribeMessage(MessageEventType.ADD_REACTION)
  @SocketHandler()
  async handleReactionAdded(
    client: SocketWithUser,
    payload: ReactionPayload,
  ): Promise<SocketResponse> {
    const { user } = client.data;

    // Validate reaction payload
    const validationError = this.messageValidator.validateReaction(payload);
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
    this.server.to(room).emit(MessageEventType.REACTION_ADDED, {
      messageId: message.id,
      userId: user.id,
      username: user.username,
      emoji: payload.emoji,
      timestamp: new Date(),
    });

    return createSuccessResponse();
  }

  @SubscribeMessage(MessageEventType.REMOVE_REACTION)
  @SocketHandler()
  async handleReactionRemoved(
    client: SocketWithUser,
    payload: ReactionPayload,
  ): Promise<SocketResponse> {
    const { user } = client.data;

    // Validate reaction payload
    const validationError = this.messageValidator.validateReaction(payload);
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
    this.server.to(room).emit(MessageEventType.REACTION_REMOVED, {
      messageId: message.id,
      userId: user.id,
      emoji: payload.emoji,
      timestamp: new Date(),
    });

    return createSuccessResponse();
  }
}
