// External dependencies
import { UsePipes } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server } from 'socket.io';
import * as config from 'config';

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';

// Internal services
import { ConversationService } from '../../conversations/services/conversation.service';
import { MessageService } from '../../messages/services/message.service';
import { MessageValidatorService } from '../services/message-validator.service';

// Events and payloads
import {
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
import { PinoLogger } from 'nestjs-pino';
import { WebsocketSanitizationPipe } from '../pipes/websocket-sanitization.pipe';
import { ParticipantEventHandler } from './usecases/participants.events';
import { MessageEventHandler } from './usecases/message.events';
import { WebsocketHelpers } from '../utils/websocket.helpers';
import { TenantService } from '../../../user-management/tenant.service';
import { wsAuthMiddleware } from '../../../middleware/ws.middleware';
@WebSocketGateway({
  cors: {
    origin: config.get('websocket.allowedOrigins'),
  },
  namespace: config.get('websocket.namespace'),
  transports: config.get('websocket.transports'),
})
// @UseGuards(WsGuard)
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;
  private readonly clientsPerUser = new Map<string, Set<string>>();

  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly messageValidator: MessageValidatorService,
    private readonly configService: ConfigService,
    private readonly participantEventHandler: ParticipantEventHandler,
    private readonly messageEventHandler: MessageEventHandler,
    private readonly websoketHelpers: WebsocketHelpers,
    private readonly logger: PinoLogger,
    private readonly tenantService: TenantService,
  ) {
    this.logger.setContext(MessagingGateway.name);
  }
  afterInit(server: Server) {
    this.logger.info('WebSocket Gateway initialized');
    server.use(
      wsAuthMiddleware(this.tenantService, this.logger, this.configService),
    );
  }

  // @UseGuards(WsGuard)
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

      this.logger.debug({
        userClients: userClients.size,
        maxClients: this.websoketHelpers.maxClientsPerUser(),
      });

      // Check if too many clients for this user
      if (userClients.size > this.websoketHelpers.maxClientsPerUser()) {
        client.emit(MessageEventType.ERROR, {
          code: 'TOO_MANY_CONNECTIONS',
          message: `Maximum of ${this.websoketHelpers.maxClientsPerUser()} connections allowed`,
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

  @UsePipes(WebsocketSanitizationPipe)
  @SubscribeMessage(MessageEventType.SEND_MESSAGE)
  @SocketHandler()
  async handleMessage(
    @MessageBody() payload: MessageEventPayload,
    @ConnectedSocket() client: SocketWithUser,
  ): Promise<SocketResponse> {
    const { user } = client.data;

    this.logger.info({ user, payload }, 'new message');

    // Rate limiting
    const throttleKey = `message:${user.id}`;
    if (this.websoketHelpers.isThrottled(throttleKey)) {
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
      this.tenantService.getTenantId(),
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
      user.sub,
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

  @SubscribeMessage(MessageEventType.UPDATE_MESSAGE)
  @SocketHandler()
  @UsePipes(WebsocketSanitizationPipe)
  async handleMessageUpdated(
    @MessageBody() payload: MessageUpdatePayload,
    @ConnectedSocket() client: SocketWithUser,
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

  @SubscribeMessage(MessageEventType.JOIN_CONVERSATION)
  @SocketHandler()
  async handleJoinConversation(
    client: SocketWithUser,
    conversationId: string,
  ): Promise<SocketResponse> {
    return await this.participantEventHandler.joinConversation(
      client,
      conversationId,
    );
  }

  @SubscribeMessage(MessageEventType.PARTICIPANT_ADD)
  @SocketHandler()
  async handleParticipantAdded(
    client: SocketWithUser,
    payload: ParticipantActionPayload,
    server: Server,
  ): Promise<SocketResponse> {
    return await this.participantEventHandler.participantAdded(
      client,
      payload,
      server,
    );
  }

  @SubscribeMessage(MessageEventType.PARTICIPANT_REMOVE)
  @SocketHandler()
  async handleParticipantRemoved(
    client: SocketWithUser,
    payload: ParticipantActionPayload,
    server: Server,
  ): Promise<SocketResponse> {
    return await this.participantEventHandler.participantRemoved(
      client,
      payload,
      server,
    );
  }

  @SubscribeMessage(MessageEventType.LEAVE_CONVERSATION)
  @SocketHandler()
  async handleLeaveConversation(
    client: SocketWithUser,
    conversationId: string,
  ): Promise<SocketResponse> {
    return await this.participantEventHandler.leaveConversation(
      client,
      conversationId,
    );
  }

  @SubscribeMessage(MessageEventType.TYPING_START)
  @SocketHandler()
  async handleTyping(
    client: SocketWithUser,
    payload: TypingEventPayload,
    server: Server,
  ): Promise<SocketResponse> {
    return await this.messageEventHandler.handleTyping(client, payload, server);
  }

  @SubscribeMessage(MessageEventType.TYPING_STOP)
  @SocketHandler()
  async handleStopTyping(
    client: SocketWithUser,
    payload: TypingEventPayload,
    server: Server,
  ): Promise<SocketResponse> {
    return await this.messageEventHandler.stopTyping(client, payload, server);
  }

  @SubscribeMessage(MessageEventType.MARK_AS_READ)
  @SocketHandler()
  async handleMarkAsRead(
    client: SocketWithUser,
    payload: ReadReceiptPayload,
    server: Server,
  ): Promise<SocketResponse> {
    return await this.messageEventHandler.markAsRead(client, payload, server);
  }

  @SubscribeMessage(MessageEventType.ADD_REACTION)
  @SocketHandler()
  async handleReactionAdded(
    client: SocketWithUser,
    payload: ReactionPayload,
    server: Server,
  ): Promise<SocketResponse> {
    return await this.messageEventHandler.reactionAdded(
      client,
      payload,
      server,
    );
  }

  @SubscribeMessage(MessageEventType.REMOVE_REACTION)
  @SocketHandler()
  async handleReactionRemoved(
    client: SocketWithUser,
    payload: ReactionPayload,
    server: Server,
  ): Promise<SocketResponse> {
    return await this.messageEventHandler.reactionRemoved(
      client,
      payload,
      server,
    );
  }
}
