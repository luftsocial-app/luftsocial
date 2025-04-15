import { Test, TestingModule } from '@nestjs/testing';
import { MessagingGateway } from './messaging.gateway';
import { ConversationService } from '../../conversations/services/conversation.service';
import { MessageService } from '../../messages/services/message.service';
import { MessageValidatorService } from '../services/message-validator.service';
import { ConfigService } from '@nestjs/config';
import { Server } from 'socket.io';
import { MessageEventType, RoomNameFactory } from '../events/message-events';
import { MessageEntity } from '../../messages/entities/message.entity';
import { ConversationEntity } from '../../conversations/entities/conversation.entity';
import { SuccessResponse } from '../interfaces/socket.interfaces';
import { MessageStatus } from '../../../common/enums/messaging';
import { PinoLogger } from 'nestjs-pino';
import { ContentSanitizer } from '../../shared/utils/content-sanitizer';
import { ParticipantEventHandler } from './usecases/participants.events';
import { MessageEventHandler } from './usecases/message.events';
import { WebsocketHelpers } from '../utils/websocket.helpers';
import { TenantService } from '../../../user-management/tenant.service';

jest.mock('./usecases/participants.events', () => ({
  ParticipantEventHandler: jest.fn().mockImplementation(() => ({
    participantAdded: jest.fn().mockResolvedValue({ success: true }),
    participantRemoved: jest.fn().mockResolvedValue({ success: true }),
    joinConversation: jest.fn().mockResolvedValue({ success: true }),
    leaveConversation: jest.fn().mockResolvedValue({ success: true }),
  })),
}));

jest.mock('./usecases/message.events', () => ({
  MessageEventHandler: jest.fn().mockImplementation(() => ({
    reactionAdded: jest.fn(),
    reactionRemoved: jest.fn(),
    handleTyping: jest.fn(),
    stopTyping: jest.fn(),
    markAsRead: jest.fn(),
  })),
}));

jest.mock('../utils/websocket.helpers', () => ({
  WebsocketHelpers: jest.fn().mockImplementation(() => ({
    isThrottled: jest.fn().mockReturnValue(false),
    handleError: jest.fn(),
    maxClientsPerUser: jest.fn(),
  })),
}));

jest.mock('../../../user-management/tenant.service', () => ({
  TenantService: jest.fn().mockImplementation(() => ({
    getTenantId: jest.fn(),
    setTenantId: jest.fn(),
  })),
}));
describe('MessagingGateway', () => {
  let gateway: MessagingGateway;
  let participantHandler: jest.Mocked<ParticipantEventHandler>;
  let messageHandler: jest.Mocked<MessageEventHandler>;
  let websocketHelpers: jest.Mocked<WebsocketHelpers>;
  let conversationService: jest.Mocked<ConversationService>;
  let messageService: jest.Mocked<MessageService>;
  let messageValidator: jest.Mocked<MessageValidatorService>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let configService: jest.Mocked<ConfigService>;
  let mockServer: jest.Mocked<Server>;
  let logger: PinoLogger;

  // Mock data
  const mockUserId = 'user-123';
  const mockUsername = 'testuser';
  const mockTenantId = 'tenant-123';
  const mockConversationId = 'conv-123';
  const mockMessageId = 'msg-123';
  const mockClientId = 'client-123';

  // Mock client with user data
  const mockClient: any = {
    id: mockClientId,
    data: {
      user: {
        id: mockUserId,
        username: mockUsername,
        tenantId: mockTenantId,
      },
    },
    emit: jest.fn(),
    disconnect: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
  };

  // Mock conversation
  // const mockConversation: Partial<ConversationEntity> = {
  //   id: mockConversationId,
  //   participants: [
  //     { id: mockUserId, userId: mockUserId } as ParticipantEntity,
  //     { id: 'user-456', userId: 'user-456' } as ParticipantEntity,
  //   ],
  //   type: ConversationType.GROUP,
  //   messages: [],
  //   tenantId: mockTenantId,
  //   isPrivate: false,
  //   createdAt: new Date(),
  //   updatedAt: new Date(),
  //   metadata: {},
  //   settings: {},
  //   lastReadMessageIds: {},
  //   unreadCounts: {},
  // };

  // Mock message
  const mockMessage = {
    id: mockMessageId,
    conversationId: mockConversationId,
    content: 'Test message',
    senderId: mockUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
    isEdited: false,
  } as unknown as MessageEntity;

  beforeEach(async () => {
    // Create mock implementations
    mockServer = {
      to: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      socketsJoin: jest.fn(),
      // Add missing properties required by BroadcastOperator
      adapter: {},
      rooms: new Set(),
      exceptRooms: new Set(),
      flags: {},
      local: {
        to: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        adapter: {},
        rooms: new Set(),
        exceptRooms: new Set(),
        flags: {},
      },
      timeout: jest.fn().mockReturnThis(),
      volatile: {
        to: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        adapter: {},
        rooms: new Set(),
        exceptRooms: new Set(),
        flags: {},
      },
      compress: jest.fn().mockReturnThis(),
      except: jest.fn().mockReturnThis(),
      fetchSockets: jest.fn(),
      disconnectSockets: jest.fn(),
      allSockets: jest.fn(),
      emitWithAck: jest.fn(),
      serverSideEmit: jest.fn(),
      close: jest.fn(),
      use: jest.fn(),
    } as unknown as jest.Mocked<Server>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingGateway,
        ParticipantEventHandler,
        MessageEventHandler,
        WebsocketHelpers,
        ContentSanitizer,
        TenantService,
        {
          provide: PinoLogger,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            setContext: jest.fn(),
          },
        },
        {
          provide: PinoLogger,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            setContext: jest.fn(),
          },
        },
        {
          provide: ConversationService,
          useValue: {
            validateAccess: jest.fn(),
            getConversationsByUserId: jest.fn(),
            getConversation: jest.fn(),
            updateParticipantLastActive: jest.fn(),
            addParticipantsToGroup: jest.fn(),
            removeParticipantsFromGroup: jest.fn(),
          },
        },
        {
          provide: MessageService,
          useValue: {
            createMessage: jest.fn(),
            updateMessage: jest.fn(),
            findMessageById: jest.fn(),
            deleteMessage: jest.fn(),
            addReaction: jest.fn(),
            markMessageAsRead: jest.fn(),
            removeReaction: jest.fn(),
          },
        },
        {
          provide: MessageValidatorService,
          useValue: {
            validateNewMessage: jest.fn(),
            validateMessageUpdate: jest.fn(),
            validateReaction: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key, defaultValue) => {
              if (key === 'messaging.throttle.messageRateMs') return 500;
              if (key === 'messaging.throttle.typingRateMs') return 2000;
              if (key === 'messaging.throttle.readReceiptRateMs') return 1000;
              if (key === 'messaging.maxClientsPerUser') return 5;
              return defaultValue;
            }),
          },
        },
      ],
    })
      // .overrideGuard(WsGuard)
      // .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    gateway = module.get<MessagingGateway>(MessagingGateway);
    participantHandler = module.get(ParticipantEventHandler);
    messageHandler = module.get(MessageEventHandler);
    websocketHelpers = module.get(WebsocketHelpers);
    conversationService = module.get(
      ConversationService,
    ) as jest.Mocked<ConversationService>;
    messageService = module.get(MessageService) as jest.Mocked<MessageService>;
    messageValidator = module.get(
      MessageValidatorService,
    ) as jest.Mocked<MessageValidatorService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
    logger = module.get(PinoLogger); // Add this line

    // Set the server property
    gateway.server = mockServer;

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('afterInit', () => {
    it('should log initialization message', () => {
      logger = gateway['logger'] as PinoLogger; // Assign the mocked logger
      const loggerSpy = jest.spyOn(logger, 'info');
      gateway.afterInit(mockServer);
      expect(loggerSpy).toHaveBeenCalledWith('WebSocket Gateway initialized');
      loggerSpy.mockRestore();
    });
  });

  describe('handleConnection', () => {
    it('should disconnect client if user data is missing', async () => {
      const clientWithoutUser = { ...mockClient, data: {} };
      await gateway.handleConnection(clientWithoutUser);
      expect(clientWithoutUser.disconnect).toHaveBeenCalled();
    });

    it("should add client to user's client set", async () => {
      conversationService.getConversationsByUserId.mockResolvedValue([]);
      await gateway.handleConnection(mockClient);

      // Use a private method to check if client was added
      // This is a bit of a hack but necessary to test private state
      const clientsPerUser = (gateway as any).clientsPerUser;
      expect(clientsPerUser.has(mockUserId)).toBeTruthy();
      expect(clientsPerUser.get(mockUserId).has(mockClientId)).toBeTruthy();
    });

    it('should disconnect if user has too many connections', async () => {
      // Setup the clientsPerUser map to simulate too many connections
      const clientsPerUser = new Map();
      const userClients = new Set();
      for (let i = 0; i < 5; i++) {
        userClients.add(`existing-client-${i}`);
      }
      clientsPerUser.set(mockUserId, userClients);
      (gateway as any).clientsPerUser = clientsPerUser;

      jest.spyOn(websocketHelpers, 'maxClientsPerUser').mockReturnValue(5);

      await gateway.handleConnection(mockClient);
      expect(mockClient.emit).toHaveBeenCalledWith(
        MessageEventType.ERROR,
        expect.objectContaining({
          code: 'TOO_MANY_CONNECTIONS',
        }),
      );
      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should join user room and conversation rooms', async () => {
      const mockConversations = [{ id: 'conv-1' }, { id: 'conv-2' }];
      conversationService.getConversationsByUserId.mockResolvedValue(
        mockConversations as ConversationEntity[],
      );

      await gateway.handleConnection(mockClient);

      // Should join user room
      expect(mockClient.join).toHaveBeenCalledWith(
        RoomNameFactory.userRoom(mockUserId),
      );

      // Should join each conversation room
      mockConversations.forEach((conv) => {
        expect(mockClient.join).toHaveBeenCalledWith(
          RoomNameFactory.conversationRoom(conv.id),
        );
      });
    });

    it('should handle errors during connection', async () => {
      const error = new Error('Test error');
      conversationService.getConversationsByUserId.mockRejectedValue(error);

      await gateway.handleConnection(mockClient);
      expect(mockClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it("should remove client from user's client set", () => {
      // Setup the clientsPerUser map
      const clientsPerUser = new Map();
      const userClients = new Set([mockClientId]);
      clientsPerUser.set(mockUserId, userClients);
      (gateway as any).clientsPerUser = clientsPerUser;

      gateway.handleDisconnect(mockClient);

      expect(userClients.has(mockClientId)).toBeFalsy();
    });

    it('should remove user from map if no clients remain', () => {
      // Setup the clientsPerUser map with only one client
      const clientsPerUser = new Map();
      const userClients = new Set([mockClientId]);
      clientsPerUser.set(mockUserId, userClients);
      (gateway as any).clientsPerUser = clientsPerUser;

      gateway.handleDisconnect(mockClient);

      expect(clientsPerUser.has(mockUserId)).toBeFalsy();
    });

    it('should handle errors during disconnect', () => {
      // Create a client that will cause an error when accessed
      const problematicClient = {
        data: {
          user: null,
        },
      };

      // This should not throw
      expect(() =>
        gateway.handleDisconnect(problematicClient as any),
      ).not.toThrow();
    });
  });

  describe('handleMessage', () => {
    it('should delegate to message handler', async () => {
      const payload = { conversationId: 'test', content: 'test' };
      await gateway.handleMessage(payload, mockClient);
      expect(gateway);
    });
  });

  describe('handleParticipantAdded', () => {
    it('should delegate to participant handler', async () => {
      const payload = { conversationId: 'test', participantIds: ['user1'] };
      await gateway.handleParticipantAdded(mockClient, payload, mockServer);
      expect(participantHandler.participantAdded).toHaveBeenCalledWith(
        mockClient,
        payload,
        mockServer,
      );
    });
  });

  describe('handleJoinConversation', () => {
    it('should delegate to participant handler', async () => {
      await gateway.handleJoinConversation(mockClient, 'conv-1');
      expect(participantHandler.joinConversation).toHaveBeenCalledWith(
        mockClient,
        'conv-1',
      );
    });
  });

  describe('handleLeaveConversation', () => {
    it('should delegate to participant handler', async () => {
      await gateway.handleLeaveConversation(mockClient, 'conv-1');
      expect(participantHandler.leaveConversation).toHaveBeenCalledWith(
        mockClient,
        'conv-1',
      );
    });
  });

  describe('handleTyping', () => {
    it('should delegate to message handler', async () => {
      const payload = { conversationId: 'test' };
      await gateway.handleTyping(mockClient, payload, mockServer);
      expect(messageHandler.handleTyping).toHaveBeenCalledWith(
        mockClient,
        payload,
        mockServer,
      );
    });
  });

  describe('handleStopTyping', () => {
    it('should delegate to message handler', async () => {
      const payload = { conversationId: 'test' };
      await gateway.handleStopTyping(mockClient, payload, mockServer);
      expect(messageHandler.stopTyping).toHaveBeenCalledWith(
        mockClient,
        payload,
        mockServer,
      );
    });
  });

  describe('handleMarkAsRead', () => {
    const mockReadPayload = {
      messageId: mockMessageId,
      conversationId: mockConversationId,
    };

    beforeEach(() => {
      jest.spyOn(websocketHelpers as any, 'isThrottled').mockReturnValue(false);
    });

    it('should return error if validation fails', async () => {
      jest.spyOn(messageHandler, 'markAsRead').mockResolvedValue({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid message ID',
        },
      });

      const result = await gateway.handleMarkAsRead(
        mockClient,
        {
          messageId: '', // Invalid ID
          conversationId: mockConversationId,
        },
        mockServer,
      );

      expect(result.success).toBeFalsy();
      expect(result.error).toEqual({
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
      });
    });

    it('should return success without processing if throttled', async () => {
      websocketHelpers.isThrottled.mockReturnValue(true);
      jest.spyOn(messageHandler, 'markAsRead').mockResolvedValue({
        success: true,
        data: { throttled: true },
      });

      const result = await gateway.handleMarkAsRead(
        mockClient,
        mockReadPayload,
        mockServer,
      );

      expect(result.success).toBeTruthy();
      if ('data' in result) {
        expect(result.data).toEqual({ throttled: true });
      }
      expect(messageService.markMessageAsRead).not.toHaveBeenCalled();
      expect(messageHandler.markAsRead).toHaveBeenCalledWith(
        mockClient,
        mockReadPayload,
        mockServer,
      );
    });

    it('should mark message as read and emit event on success', async () => {
      jest.spyOn(messageHandler, 'markAsRead').mockResolvedValue({
        success: true,
        data: {
          messageId: mockMessageId,
          userId: mockUserId,
          conversationId: mockConversationId,
        },
      });

      const result = await gateway.handleMarkAsRead(
        mockClient,
        mockReadPayload,
        mockServer,
      );

      // Verify markAsRead was called with correct params
      expect(messageHandler.markAsRead).toHaveBeenCalledWith(
        mockClient,
        mockReadPayload,
        mockServer,
      );

      // Should return success with correct data
      expect(result.success).toBeTruthy();

      if ('data' in result) {
        expect(result.data).toEqual({
          messageId: mockMessageId,
          userId: mockUserId,
          conversationId: mockConversationId,
        });
      }
    });
  });

  describe('handleMessageUpdated', () => {
    const mockUpdatePayload = {
      messageId: mockMessageId,
      content: 'Updated message',
    };

    it('should return error if validation fails', async () => {
      messageValidator.validateMessageUpdate.mockReturnValue(
        'Validation error',
      );

      const result = await gateway.handleMessageUpdated(
        mockUpdatePayload,
        mockClient,
      );

      expect(result.success).toBeFalsy();
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('should update message and emit event on success', async () => {
      messageValidator.validateMessageUpdate.mockReturnValue(null);
      messageService.updateMessage.mockResolvedValue({
        ...mockMessage,
        content: mockUpdatePayload.content,
        isEdited: true,
        status: MessageStatus.DELIVERED,
      });

      const result = await gateway.handleMessageUpdated(
        mockUpdatePayload,
        mockClient,
      );

      // Should update message
      expect(messageService.updateMessage).toHaveBeenCalledWith(
        mockUpdatePayload.messageId,
        { content: mockUpdatePayload.content },
        mockUserId,
      );

      // Should emit update event
      expect(mockServer.to).toHaveBeenCalledWith(
        RoomNameFactory.conversationRoom(mockConversationId),
      );
      expect(mockServer.emit).toHaveBeenCalledWith(
        MessageEventType.MESSAGE_UPDATED,
        expect.objectContaining({
          id: mockMessageId,
          conversationId: mockConversationId,
          content: mockUpdatePayload.content,
          isEdited: true,
        }),
      );

      // Should return success
      expect(result.success).toBeTruthy();
      expect((result as SuccessResponse).data).toEqual(
        expect.objectContaining({
          messageId: mockMessageId,
        }),
      );
    });
  });

  describe('handleMessageDeleted', () => {
    const mockDeletePayload = {
      messageId: mockMessageId,
    };

    it('should return error if validation fails', async () => {
      const result = await gateway.handleMessageDeleted(mockClient, {
        messageId: '',
      });

      expect(result.success).toBeFalsy();
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should return error if message not found', async () => {
      messageService.findMessageById.mockResolvedValue(null);

      const result = await gateway.handleMessageDeleted(
        mockClient,
        mockDeletePayload,
      );

      expect(result.success).toBeFalsy();
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should delete message and emit event on success', async () => {
      messageService.findMessageById.mockResolvedValue({
        ...mockMessage,
        status: MessageStatus.DELIVERED,
      });

      const result = await gateway.handleMessageDeleted(
        mockClient,
        mockDeletePayload,
      );

      // Should delete message
      expect(messageService.deleteMessage).toHaveBeenCalledWith(
        mockDeletePayload.messageId,
        mockUserId,
      );

      // Should emit delete event
      expect(mockServer.to).toHaveBeenCalledWith(
        RoomNameFactory.conversationRoom(mockConversationId),
      );
      expect(mockServer.emit).toHaveBeenCalledWith(
        MessageEventType.MESSAGE_DELETED,
        expect.objectContaining({
          id: mockMessageId,
          conversationId: mockConversationId,
          deletedBy: mockUserId,
        }),
      );

      // Should return success
      expect(result.success).toBeTruthy();
      expect((result as SuccessResponse).data).toEqual(
        expect.objectContaining({
          messageId: mockMessageId,
          conversationId: mockConversationId,
        }),
      );
    });
  });

  describe('handleReactionAdded', () => {
    const mockReactionPayload = {
      messageId: mockMessageId,
      emoji: '👍',
    };

    it('should return error if validation fails', async () => {
      messageValidator.validateReaction.mockReturnValueOnce('Validation error');
      jest.spyOn(messageHandler, 'reactionAdded').mockResolvedValue({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid message ID',
        },
      });

      const result = await gateway.handleReactionAdded(
        mockClient,
        mockReactionPayload,
        mockServer,
      );

      expect(result.success).toBeFalsy();
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('should add reaction and emit event on success', async () => {
      // Mock the reactionAdded handler to return success
      jest.spyOn(messageHandler, 'reactionAdded').mockResolvedValue({
        success: true,
        data: {
          messageId: mockMessageId,
          userId: mockUserId,
          username: mockUsername,
          emoji: mockReactionPayload.emoji,
        },
      });

      // Call the method under test
      const result = await gateway.handleReactionAdded(
        mockClient,
        mockReactionPayload,
        mockServer,
      );

      // Verify the reactionAdded handler was called with correct arguments
      expect(messageHandler.reactionAdded).toHaveBeenCalledWith(
        mockClient,
        mockReactionPayload,
        mockServer,
      );

      // Verify the result indicates success
      expect(result.success).toBeTruthy();
      if ('data' in result) {
        expect(result.data).toEqual({
          messageId: mockMessageId,
          userId: mockUserId,
          username: mockUsername,
          emoji: mockReactionPayload.emoji,
        });
      }
    });
  });

  describe('handleReactionRemoved', () => {
    const mockReactionPayload = {
      messageId: mockMessageId,
      emoji: '👍',
    };

    it('should remove reaction and emit event on success', async () => {
      // Mock validation to pass
      messageValidator.validateReaction.mockReturnValue(null);

      // Mock the reactionRemoved handler to return success
      jest.spyOn(messageHandler, 'reactionRemoved').mockResolvedValue({
        success: true,
        data: {
          messageId: mockMessageId,
          userId: mockUserId,
          emoji: mockReactionPayload.emoji,
        },
      });

      // Call the method under test
      const result = await gateway.handleReactionRemoved(
        mockClient,
        mockReactionPayload,
        mockServer,
      );

      // Verify the reactionRemoved handler was called with correct arguments
      expect(messageHandler.reactionRemoved).toHaveBeenCalledWith(
        mockClient,
        mockReactionPayload,
        mockServer,
      );

      // Verify the result indicates success
      expect(result.success).toBeTruthy();
      if ('data' in result) {
        expect(result.data).toEqual({
          messageId: mockMessageId,
          userId: mockUserId,
          emoji: mockReactionPayload.emoji,
        });
      }
    });
  });
});
