import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger, Inject, forwardRef } from '@nestjs/common';
import { WsGuard } from '../../../guards/ws.guard';
import { ConversationService } from '../../conversations/services/conversation.service';
import { MessageService } from '../../messages/services/message.service';
import { 
  MessageEventType, 
  RoomNameFactory,
  MessageEventPayload, 
  MessageUpdatePayload, 
  TypingEventPayload, 
  ReadReceiptPayload,
  ReactionPayload,
  ParticipantActionPayload,
  MessageDeletePayload,
  ErrorEvent
} from '../events/message-events';
import { MessageValidatorService } from '../services/message-validator.service';
import { ConfigService } from '@nestjs/config';
import { MessageEntity } from '../../messages/entities/message.entity';

interface SocketWithUser extends Socket {
  data: {
    user: {
      id: string;
      username: string;
      tenantId: string;
      [key: string]: any;
    };
    deviceId?: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: '*', // In production, specify exact origins
  },
  namespace: 'messaging',
  transports: ['websocket', 'polling'],
})
@UseGuards(WsGuard)
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagingGateway.name);
  private readonly throttleTimers = new Map<string, number>();
  private readonly THROTTLE_TIME_MS: number;
  private readonly MAX_CLIENTS_PER_USER: number;
  private readonly clientsPerUser = new Map<string, Set<string>>();
  
  constructor(
    @Inject(forwardRef(() => ConversationService))
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly messageValidator: MessageValidatorService,
    private readonly configService: ConfigService,
  ) {
    // Get config values with defaults
    this.THROTTLE_TIME_MS = this.configService.get<number>('MESSAGING_THROTTLE_MS', 500);
    this.MAX_CLIENTS_PER_USER = this.configService.get<number>('MAX_CLIENTS_PER_USER', 5);
  }

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    
    // Setup periodic cleanup of throttle timers
    setInterval(() => {
      const now = Date.now();
      for (const [key, timestamp] of this.throttleTimers.entries()) {
        if (now - timestamp > this.THROTTLE_TIME_MS * 2) {
          this.throttleTimers.delete(key);
        }
      }
    }, 60000); // Clean up every minute
  }

  async handleConnection(client: SocketWithUser) {
    try {
      const { user } = client.data;
      
      if (!user || !user.id) {
        this.logger.warn('Client connection rejected: missing user data');
        client.disconnect();
        return;
      }
      
      this.logger.debug(`Client connected: ${user.id} (${client.id})`);
      
      // Add to user's personal room
      const userRoom = RoomNameFactory.userRoom(user.id);
      client.join(userRoom);
      
      // Keep track of connections per user and limit if necessary
      if (!this.clientsPerUser.has(user.id)) {
        this.clientsPerUser.set(user.id, new Set());
      }
      this.clientsPerUser.get(user.id).add(client.id);
      
      // Check if user has too many connections
      if (this.clientsPerUser.get(user.id).size > this.MAX_CLIENTS_PER_USER) {
        this.logger.warn(`User ${user.id} has too many connections (${this.clientsPerUser.get(user.id).size})`);
        // Could implement a strategy to disconnect oldest connection
      }

      // Join all user's conversation rooms
      const conversations = await this.conversationService.getConversationsByUserId(user.id);
      for (const conv of conversations) {
        const roomName = RoomNameFactory.conversationRoom(conv.id);
        client.join(roomName);
      }
      
      client.emit('connected', { 
        status: 'connected', 
        userId: user.id,
        clientId: client.id,
        conversationCount: conversations.length 
      });
      
    } catch (error) {
      this.logger.error(`Error handling connection: ${error.message}`, error.stack);
      client.disconnect();
    }
  }

  handleDisconnect(client: SocketWithUser) {
    try {
      const { user } = client.data;
      if (user && user.id) {
        this.logger.debug(`Client disconnected: ${user.id} (${client.id})`);
        
        // Remove client from tracking
        if (this.clientsPerUser.has(user.id)) {
          this.clientsPerUser.get(user.id).delete(client.id);
          if (this.clientsPerUser.get(user.id).size === 0) {
            this.clientsPerUser.delete(user.id);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error handling disconnection: ${error.message}`, error.stack);
    }
  }

  private isThrottled(key: string): boolean {
    const now = Date.now();
    const lastTime = this.throttleTimers.get(key) || 0;
    
    if (now - lastTime < this.THROTTLE_TIME_MS) {
      return true;
    }
    
    this.throttleTimers.set(key, now);
    return false;
  }

  private handleError(client: SocketWithUser, errorEvent: ErrorEvent): void {
    this.logger.warn(`Error for client ${client.id}: ${errorEvent.code} - ${errorEvent.message}`);
    client.emit(MessageEventType.ERROR, errorEvent);
  }

  @SubscribeMessage(MessageEventType.SEND_MESSAGE)
  async handleMessage(client: SocketWithUser, payload: MessageEventPayload) {
    try {
      const { user } = client.data;
      
      // Rate limiting
      const throttleKey = `message:${user.id}`;
      if (this.isThrottled(throttleKey)) {
        return { 
          success: false, 
          error: {
            code: 'RATE_LIMITED',
            message: 'You are sending messages too quickly'
          }
        };
      }

      // Validate payload
      const validationError = this.messageValidator.validateNewMessage(payload);
      if (validationError) {
        return { 
          success: false, 
          error: {
            code: 'VALIDATION_ERROR', 
            message: validationError
          }
        };
      }

      // Validate access
      const hasAccess = await this.conversationService.validateAccess(
        payload.conversationId,
        user.id,
        user.tenantId,
      );

      if (!hasAccess) {
        return { 
          success: false, 
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have access to this conversation'
          }
        };
      }

      // Save message
      let message: MessageEntity;
      try {
        message = await this.conversationService.createMessage(
          payload.conversationId,
          payload.content,
          user.id,
        );
      } catch (error) {
        this.logger.error(`Error creating message: ${error.message}`, error.stack);
        return { 
          success: false, 
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to save message'
          }
        };
      }

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

      return { 
        success: true, 
        messageId: message.id,
        timestamp: message.createdAt
      };
    } catch (error) {
      this.logger.error(`Error in handleMessage: ${error.message}`, error.stack);
      return { 
        success: false, 
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred'
        }
      };
    }
  }

  @SubscribeMessage(MessageEventType.JOIN_CONVERSATION)
  async handleJoinConversation(client: SocketWithUser, conversationId: string) {
    try {
      const { user } = client.data;

      const hasAccess = await this.conversationService.validateAccess(
        conversationId,
        user.id,
        user.tenantId,
      );

      if (hasAccess) {
        const room = RoomNameFactory.conversationRoom(conversationId);
        client.join(room);
        
        // Update participant's last active time
        await this.conversationService.updateParticipantLastActive(user.id, conversationId);
        
        return { success: true, conversationId };
      }

      return { 
        success: false, 
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have access to this conversation'
        }
      };
    } catch (error) {
      this.logger.error(`Error in handleJoinConversation: ${error.message}`, error.stack);
      return { 
        success: false, 
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred'
        }
      };
    }
  }

  @SubscribeMessage(MessageEventType.LEAVE_CONVERSATION)
  async handleLeaveConversation(client: SocketWithUser, conversationId: string) {
    try {
      const room = RoomNameFactory.conversationRoom(conversationId);
      client.leave(room);
      return { success: true, conversationId };
    } catch (error) {
      this.logger.error(`Error in handleLeaveConversation: ${error.message}`, error.stack);
      return { 
        success: false, 
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred'
        }
      };
    }
  }

  @SubscribeMessage(MessageEventType.TYPING_START)
  async handleTyping(client: SocketWithUser, payload: TypingEventPayload) {
    try {
      const { user } = client.data;
      
      // Rate limiting for typing events
      const throttleKey = `typing:${user.id}:${payload.conversationId}`;
      if (this.isThrottled(throttleKey)) {
        return; // Silently ignore - not critical to notify the user
      }

      const room = RoomNameFactory.conversationRoom(payload.conversationId);
      this.server.to(room).emit(MessageEventType.USER_TYPING, {
        conversationId: payload.conversationId,
        user: {
          id: user.id,
          username: user.username,
        },
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error in handleTyping: ${error.message}`, error.stack);
      return { success: false };
    }
  }

  @SubscribeMessage(MessageEventType.TYPING_STOP)
  async handleStopTyping(client: SocketWithUser, payload: TypingEventPayload) {
    try {
      const { user } = client.data;

      const room = RoomNameFactory.conversationRoom(payload.conversationId);
      this.server.to(room).emit(MessageEventType.USER_STOPPED_TYPING, {
        conversationId: payload.conversationId,
        userId: user.id,
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error in handleStopTyping: ${error.message}`, error.stack);
      return { success: false };
    }
  }

  @SubscribeMessage(MessageEventType.MARK_AS_READ)
  async handleMarkAsRead(client: SocketWithUser, payload: ReadReceiptPayload) {
    try {
      const { user } = client.data;
      
      // Rate limiting for read receipts
      const throttleKey = `read:${user.id}:${payload.messageId}`;
      if (this.isThrottled(throttleKey)) {
        return { success: true }; // Return success but don't process - this is a high frequency event
      }
      
      await this.conversationService.markMessageAsRead(payload.messageId, user.id);

      // Notify other participants
      const room = RoomNameFactory.conversationRoom(payload.conversationId);
      this.server.to(room).emit(MessageEventType.MESSAGE_READ, {
        messageId: payload.messageId,
        userId: user.id,
        conversationId: payload.conversationId,
        readAt: new Date(),
      });
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Error in handleMarkAsRead: ${error.message}`, error.stack);
      return { 
        success: false, 
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to mark message as read'
        }
      };
    }
  }

  @SubscribeMessage(MessageEventType.UPDATE_MESSAGE)
  async handleMessageUpdated(client: SocketWithUser, payload: MessageUpdatePayload) {
    try {
      const { user } = client.data;
      
      // Validate update payload
      const validationError = this.messageValidator.validateMessageUpdate(payload);
      if (validationError) {
        return { 
          success: false, 
          error: {
            code: 'VALIDATION_ERROR',
            message: validationError
          }
        };
      }
      
      // Update message
      try {
        const message = await this.messageService.updateMessage(
          payload.messageId,
          { content: payload.content },
          user.id
        );
        
        const room = RoomNameFactory.conversationRoom(message.conversationId);
        this.server.to(room).emit(MessageEventType.MESSAGE_UPDATED, {
          id: message.id,
          conversationId: message.conversationId,
          content: message.content,
          updatedAt: message.updatedAt,
          isEdited: message.isEdited,
          editVersion: message.metadata?.editHistory?.length || 1,
        });
        
        return { success: true };
      } catch (error) {
        if (error instanceof WsException) {
          throw error;
        }
        
        // Handle specific errors
        if (error.message.includes('not found')) {
          return { 
            success: false, 
            error: {
              code: 'NOT_FOUND',
              message: 'Message not found'
            }
          };
        } else if (error.message.includes('own messages')) {
          return { 
            success: false, 
            error: {
              code: 'FORBIDDEN',
              message: 'You can only edit your own messages'
            }
          };
        }
        
        throw error;
      }
    } catch (error) {
      this.logger.error(`Error in handleMessageUpdated: ${error.message}`, error.stack);
      return { 
        success: false, 
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred'
        }
      };
    }
  }

  @SubscribeMessage(MessageEventType.DELETE_MESSAGE)
  async handleMessageDeleted(client: SocketWithUser, payload: MessageDeletePayload) {
    try {
      const { user } = client.data;
      
      // Get message before deletion to know conversation ID
      const message = await this.messageService.findMessageById(
        payload.messageId,
        user.tenantId
      );
      
      if (!message) {
        return { 
          success: false, 
          error: {
            code: 'NOT_FOUND',
            message: 'Message not found'
          }
        };
      }
      
      const conversationId = message.conversationId;
      
      // Delete message
      try {
        await this.messageService.deleteMessage(payload.messageId, user.id);
        
        // Broadcast deletion to all participants
        const room = RoomNameFactory.conversationRoom(conversationId);
        this.server.to(room).emit(MessageEventType.MESSAGE_DELETED, {
          id: payload.messageId,
          conversationId,
          deletedBy: user.id,
          deletedAt: new Date(),
        });
        
        return { success: true };
      } catch (error) {
        if (error.message.includes('not found')) {
          return { 
            success: false, 
            error: {
              code: 'NOT_FOUND',
              message: 'Message not found'
            }
          };
        } else if (error.message.includes('own messages')) {
          return { 
            success: false, 
            error: {
              code: 'FORBIDDEN',
              message: 'You can only delete your own messages'
            }
          };
        }
        
        throw error;
      }
    } catch (error) {
      this.logger.error(`Error in handleMessageDeleted: ${error.message}`, error.stack);
      return { 
        success: false, 
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred'
        }
      };
    }
  }

  @SubscribeMessage(MessageEventType.ADD_REACTION)
  async handleReactionAdded(client: SocketWithUser, payload: ReactionPayload) {
    try {
      const { user } = client.data;
      
      // Validate reaction payload
      const validationError = this.messageValidator.validateReaction(payload);
      if (validationError) {
        return { 
          success: false, 
          error: {
            code: 'VALIDATION_ERROR',
            message: validationError
          }
        };
      }
      
      try {
        const message = await this.messageService.addReaction(
          payload.messageId,
          user.id,
          payload.emoji
        );
        
        const room = RoomNameFactory.conversationRoom(message.conversationId);
        this.server.to(room).emit(MessageEventType.REACTION_ADDED, {
          messageId: message.id,
          userId: user.id,
          emoji: payload.emoji,
          timestamp: new Date()
        });
        
        return { success: true };
      } catch (error) {
        if (error.message.includes('not found')) {
          return { 
            success: false, 
            error: {
              code: 'NOT_FOUND',
              message: 'Message not found'
            }
          };
        }
        
        throw error;
      }
    } catch (error) {
      this.logger.error(`Error in handleReactionAdded: ${error.message}`, error.stack);
      return { 
        success: false, 
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred'
        }
      };
    }
  }

  @SubscribeMessage(MessageEventType.REMOVE_REACTION)
  async handleReactionRemoved(client: SocketWithUser, payload: ReactionPayload) {
    try {
      const { user } = client.data;
      
      // Validate reaction payload
      const validationError = this.messageValidator.validateReaction(payload);
      if (validationError) {
        return { 
          success: false, 
          error: {
            code: 'VALIDATION_ERROR',
            message: validationError
          }
        };
      }
      
      try {
        const message = await this.messageService.removeReaction(
          payload.messageId,
          user.id,
          payload.emoji
        );
        
        const room = RoomNameFactory.conversationRoom(message.conversationId);
        this.server.to(room).emit(MessageEventType.REACTION_REMOVED, {
          messageId: message.id,
          userId: user.id,
          emoji: payload.emoji,
          timestamp: new Date()
        });
        
        return { success: true };
      } catch (error) {
        if (error.message.includes('not found')) {
          return { 
            success: false, 
            error: {
              code: 'NOT_FOUND',
              message: 'Message not found'
            }
          };
        }
        
        throw error;
      }
    } catch (error) {
      this.logger.error(`Error in handleReactionRemoved: ${error.message}`, error.stack);
      return { 
        success: false, 
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred'
        }
      };
    }
  }

  @SubscribeMessage(MessageEventType.PARTICIPANT_ADD)
  async handleParticipantAdded(client: SocketWithUser, payload: ParticipantActionPayload) {
    try {
      const { user } = client.data;
      
      if (!payload.conversationId || !payload.participantIds || !payload.participantIds.length) {
        return { 
          success: false, 
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid participant data'
          }
        };
      }
      
      try {
        const conversation = await this.conversationService.addParticipantsToGroup(
          payload.conversationId,
          payload.participantIds,
          user.id
        );
        
        // Notify existing participants
        const room = RoomNameFactory.conversationRoom(conversation.id);
        this.server.to(room).emit(MessageEventType.PARTICIPANTS_UPDATED, {
          conversationId: conversation.id,
          action: 'added',
          actorId: user.id,
          participants: payload.participantIds.map(id => ({ id })),
          timestamp: new Date()
        });
        
        // Add new participants to the conversation room
        for (const participantId of payload.participantIds) {
          const userRoom = RoomNameFactory.userRoom(participantId);
          this.server.to(userRoom).socketsJoin(room);
        }
        
        return { success: true };
      } catch (error) {
        if (error.message.includes('direct chat')) {
          return { 
            success: false, 
            error: {
              code: 'INVALID_OPERATION',
              message: 'Cannot add participants to direct chat'
            }
          };
        } else if (error.message.includes('Only admins')) {
          return { 
            success: false, 
            error: {
              code: 'FORBIDDEN',
              message: 'Only admins can add participants'
            }
          };
        }
        
        throw error;
      }
    } catch (error) {
      this.logger.error(`Error in handleParticipantAdded: ${error.message}`, error.stack);
      return { 
        success: false, 
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred'
        }
      };
    }
  }

  @SubscribeMessage(MessageEventType.PARTICIPANT_REMOVE)
  async handleParticipantRemoved(client: SocketWithUser, payload: ParticipantActionPayload) {
    try {
      const { user } = client.data;
      
      // Implementation of participant removal logic would go here
      // Similar to the add participants logic but with appropriate modifications
      
      return { 
        success: false, 
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Participant removal not yet implemented'
        }
      };
    } catch (error) {
      this.logger.error(`Error in handleParticipantRemoved: ${error.message}`, error.stack);
      return { 
        success: false, 
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred'
        }
      };
    }
  }
} 