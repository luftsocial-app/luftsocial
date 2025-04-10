import { Test, TestingModule } from '@nestjs/testing';
import { MessagingGateway } from './messaging.gateway';
import { ConversationService } from '../../conversations/services/conversation.service';
import { MessageService } from '../../messages/services/message.service';
import { MessageValidatorService } from '../services/message-validator.service';
import { ConfigService } from '@nestjs/config';
import { Server } from 'socket.io';
import {
  MessageEventPayload,
  MessageEventType,
  RoomNameFactory,
} from '../events/message-events';
import { WsGuard } from '../../../guards/ws.guard';
import { MessageEntity } from '../../messages/entities/message.entity';
import { ConversationEntity } from '../../conversations/entities/conversation.entity';
import { ParticipantEntity } from '../../conversations/entities/participant.entity';
import { ConversationType } from '../../shared/enums/conversation-type.enum';
import { SuccessResponse } from '../interfaces/socket.interfaces';
import { MessageStatus } from '../../../common/enums/messaging';
import { PinoLogger } from 'nestjs-pino';
import { ContentSanitizer } from '../../shared/utils/content-sanitizer';
import { ParticipantEventHandler } from './usecases/participants.events';
import { MessageEventHandler } from './usecases/message.events';
import { WebsocketHelpers } from '../utils/websocket.helpers';

jest.mock('./usecases/participants.events', () => {
  return {
    ParticipantEventHandler: jest.fn().mockImplementation(() => {
      return {
        participantAdded: jest.fn(),
        joinConversation: jest.fn(),
        leaveConversation: jest.fn(),
        participantRemoved: jest.fn(),
      };
    }),
  };
});
jest.mock('./usecases/message.events', () => {
  return {
    MessageEventHandler: jest.fn().mockImplementation(() => {
      return {
        reactionRemoved: jest.fn(),
        reactionAdded: jest.fn(),
        handleTyping: jest.fn(),
        stopTyping: jest.fn(),
        markAsRead: jest.fn(),
      };
    }),
  };
});

jest.mock('../utils/websocket.helpers', () => {
  return {
    WebsocketHelpers: jest.fn().mockImplementation(() => {
      return {
        isThrottled: jest.fn(),
        typingThrottle: jest.fn(),
        readReceiptThrottle: jest.fn(),
        messageThrottle: jest.fn(),
        maxClientPerUser: jest.fn(),
        handleError: jest.fn(),
      };
    }),
  };
});

describe('MessagingGateway', () => {
  let gateway: MessagingGateway;
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
  const mockConversation: Partial<ConversationEntity> = {
    id: mockConversationId,
    participants: [
      { id: mockUserId, userId: mockUserId } as ParticipantEntity,
      { id: 'user-456', userId: 'user-456' } as ParticipantEntity,
    ],
    type: ConversationType.GROUP,
    messages: [],
    tenantId: mockTenantId,
    isPrivate: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {},
    settings: {},
    lastReadMessageIds: {},
    unreadCounts: {},
  };

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
    } as unknown as jest.Mocked<Server>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingGateway,
        ParticipantEventHandler,
        MessageEventHandler,
        WebsocketHelpers,
        ContentSanitizer,
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
      .overrideGuard(WsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    gateway = module.get<MessagingGateway>(MessagingGateway);
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
      gateway.afterInit();
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

  describe('isThrottled', () => {
    it('should return false for first call with a key', () => {
      const result = (gateway as any).isThrottled('test-key', 2000);
      expect(result).toBeFalsy();
    });

    it('should return true for rapid subsequent calls', () => {
      // First call sets the timer
      (gateway as any).isThrottled('test-key', 2000);

      // Second call should be throttled
      const result = (gateway as any).isThrottled('test-key', 2000);
      expect(result).toBeTruthy();
    });

    it('should return false after throttle time has passed', () => {
      // Mock Date.now to control time
      const originalNow = Date.now;
      const mockNow = jest.fn();
      Date.now = mockNow;

      // First call at time 1000
      mockNow.mockReturnValue(1000);
      (gateway as any).isThrottled('test-key', 2000);

      // Second call after throttle time (2000ms)
      mockNow.mockReturnValue(3001);
      const result = (gateway as any).isThrottled('test-key', 2000);

      expect(result).toBeFalsy();

      // Restore original Date.now
      Date.now = originalNow;
    });
  });

  describe('handleMessage', () => {
    const mockPayload = {
      conversationId: mockConversationId,
      content: 'Test message',
    } as unknown as MessageEventPayload;

    beforeEach(() => {
      // Mock the isThrottled method to always return false (not throttled)
      jest.spyOn(gateway as any, 'isThrottled').mockReturnValue(false);
    });

    it('should return error if throttled', async () => {
      // Override the mock to return true (throttled)
      (gateway as any).isThrottled.mockReturnValue(true);

      const result = await gateway.handleMessage(mockPayload, mockClient);

      expect(result.success).toBeFalsy();
      expect(result.error.code).toBe('RATE_LIMITED');
    });

    it('should return error if validation fails', async () => {
      messageValidator.validateNewMessage.mockReturnValue('Validation error');

      const result = await gateway.handleMessage(mockPayload, mockClient);

      expect(result.success).toBeFalsy();
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return error if user lacks access', async () => {
      messageValidator.validateNewMessage.mockReturnValue(null);
      conversationService.validateAccess.mockResolvedValue(false);

      const result = await gateway.handleMessage(mockPayload, mockClient);

      expect(result.success).toBeFalsy();
      expect(result.error.code).toBe('ACCESS_DENIED');
    });

    it('should create message and emit event on success', async () => {
      // Setup mocks for success path
      messageValidator.validateNewMessage.mockReturnValue(null);
      conversationService.validateAccess.mockResolvedValue(true);
      messageService.createMessage.mockResolvedValue(mockMessage);
      conversationService.getConversation.mockResolvedValue(
        mockConversation as ConversationEntity,
      );

      const result = await gateway.handleMessage(mockPayload, mockClient);

      // Verify message was created
      expect(messageService.createMessage).toHaveBeenCalledWith(
        mockPayload.conversationId,
        mockPayload.content,
        mockUserId,
      );

      // Verify event was emitted
      expect(mockServer.to).toHaveBeenCalledWith(
        RoomNameFactory.conversationRoom(mockConversationId),
      );
      expect(mockServer.emit).toHaveBeenCalledWith(
        MessageEventType.MESSAGE_CREATED,
        expect.objectContaining({
          id: mockMessage.id,
          conversationId: mockConversationId,
        }),
      );

      // Verify success response
      expect(result.success).toBeTruthy();
      expect((result as SuccessResponse).data).toEqual(
        expect.objectContaining({
          messageId: mockMessage.id,
        }),
      );
    });
  });

  describe('handleJoinConversation', () => {
    it('should return error if user lacks access', async () => {
      conversationService.validateAccess.mockResolvedValue(false);

      const result = await gateway.handleJoinConversation(
        mockClient,
        mockConversationId,
      );

      expect(result.success).toBeFalsy();
      expect(result.error.code).toBe('ACCESS_DENIED');
    });

    it('should join room and update last active on success', async () => {
      conversationService.validateAccess.mockResolvedValue(true);

      const result = await gateway.handleJoinConversation(
        mockClient,
        mockConversationId,
      );

      // Should join the conversation room
      expect(mockClient.join).toHaveBeenCalledWith(
        RoomNameFactory.conversationRoom(mockConversationId),
      );

      // Should update participant's last active timestamp
      expect(
        conversationService.updateParticipantLastActive,
      ).toHaveBeenCalledWith(mockUserId, mockConversationId);

      // Should return success
      expect(result.success).toBeTruthy();
      expect((result as SuccessResponse).data).toEqual(
        expect.objectContaining({
          conversationId: mockConversationId,
        }),
      );
    });
  });

  describe('handleParticipantAdded', () => {
    const mockParticipantPayload = {
      conversationId: mockConversationId,
      participantIds: ['user-456', 'user-789'],
    };

    it('should return error if validation fails', async () => {
      const result = await gateway.handleParticipantAdded(mockClient, {
        conversationId: mockConversationId,
        participantIds: [], // Empty array should fail validation
      });

      expect(result.success).toBeFalsy();
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('should add participants and emit event on success', async () => {
      conversationService.addParticipantsToGroup.mockResolvedValue(
        mockConversation as ConversationEntity,
      );

      const result = await gateway.handleParticipantAdded(
        mockClient,
        mockParticipantPayload,
      );

      // Should add participants
      expect(conversationService.addParticipantsToGroup).toHaveBeenCalledWith(
        mockParticipantPayload.conversationId,
        mockParticipantPayload.participantIds,
        mockUserId,
      );

      // Should emit event to conversation room
      expect(mockServer.to).toHaveBeenCalledWith(
        RoomNameFactory.conversationRoom(mockConversationId),
      );
      expect(mockServer.emit).toHaveBeenCalledWith(
        MessageEventType.PARTICIPANTS_UPDATED,
        expect.objectContaining({
          conversationId: mockConversationId,
          action: 'added',
        }),
      );

      // Should add new participants to the conversation room
      mockParticipantPayload.participantIds.forEach((id) => {
        expect(mockServer.to).toHaveBeenCalledWith(
          RoomNameFactory.userRoom(id),
        );
      });

      // Should return success
      expect(result.success).toBeTruthy();
    });
  });

  describe('handleParticipantRemoved', () => {
    const mockParticipantPayload = {
      conversationId: mockConversationId,
      participantIds: ['user-456'],
    };

    it('should return error if validation fails', async () => {
      const result = await gateway.handleParticipantRemoved(mockClient, {
        conversationId: mockConversationId,
        participantIds: [], // Empty array should fail validation
      });

      expect(result.success).toBeFalsy();
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('should remove participants and emit event on success', async () => {
      // Mock socket fetching
      const mockSocket = { leave: jest.fn() };
      const mockFetchSockets = jest.fn().mockResolvedValue([mockSocket]);
      mockServer.in.mockReturnValue({
        fetchSockets: mockFetchSockets,
        adapter: {},
        rooms: new Set(),
        exceptRooms: new Set(),
        flags: {},
        emit: jest.fn(),
        to: jest.fn(),
        except: jest.fn(),
        timeout: jest.fn(),
        local: jest.fn().mockReturnValue({
          adapter: {},
          rooms: new Set(),
          exceptRooms: new Set(),
          flags: {},
          emit: jest.fn(),
          to: jest.fn(),
          except: jest.fn(),
          timeout: jest.fn(),
        }),
      } as any);
      conversationService.removeParticipantsFromGroup.mockResolvedValue(
        mockConversation as ConversationEntity,
      );

      const result = await gateway.handleParticipantRemoved(
        mockClient,
        mockParticipantPayload,
      );

      // Should remove participants
      expect(
        conversationService.removeParticipantsFromGroup,
      ).toHaveBeenCalledWith(
        mockParticipantPayload.conversationId,
        mockParticipantPayload.participantIds,
        mockUserId,
      );

      // Should emit event to conversation room
      expect(mockServer.to).toHaveBeenCalledWith(
        RoomNameFactory.conversationRoom(mockConversationId),
      );
      expect(mockServer.emit).toHaveBeenCalledWith(
        MessageEventType.PARTICIPANTS_UPDATED,
        expect.objectContaining({
          conversationId: mockConversationId,
          action: 'removed',
        }),
      );

      // Should make removed participants leave the room
      expect(mockServer.in).toHaveBeenCalledWith(
        RoomNameFactory.userRoom(mockParticipantPayload.participantIds[0]),
      );
      expect(mockFetchSockets).toHaveBeenCalled();
      expect(mockSocket.leave).toHaveBeenCalledWith(
        RoomNameFactory.conversationRoom(mockConversationId),
      );

      // Should return success
      expect(result.success).toBeTruthy();
    });
  });

  describe('handleLeaveConversation', () => {
    it('should leave conversation room and return success', async () => {
      const result = await gateway.handleLeaveConversation(
        mockClient,
        mockConversationId,
      );

      // Should leave the conversation room
      expect(mockClient.leave).toHaveBeenCalledWith(
        RoomNameFactory.conversationRoom(mockConversationId),
      );

      // Should return success
      expect(result.success).toBeTruthy();
      expect((result as SuccessResponse).data).toEqual(
        expect.objectContaining({
          conversationId: mockConversationId,
        }),
      );
    });
  });

  describe('handleTyping', () => {
    const mockTypingPayload = {
      conversationId: mockConversationId,
    };

    beforeEach(() => {
      jest.spyOn(gateway as any, 'isThrottled').mockReturnValue(false);
    });

    it('should return error if validation fails', async () => {
      const result = await gateway.handleTyping(mockClient, {
        conversationId: '', // Invalid ID
      });

      expect(result.success).toBeFalsy();
      expect(result.error).toEqual({
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
      });
    });

    it('should return success without emitting if throttled', async () => {
      (gateway as any).isThrottled.mockReturnValue(true);

      const result = await gateway.handleTyping(mockClient, mockTypingPayload);

      expect(result.success).toBeTruthy();
      expect((result as SuccessResponse).data).toEqual(
        expect.objectContaining({ throttled: true }),
      );
      expect(mockServer.emit).not.toHaveBeenCalled();
    });

    it('should emit typing event on success', async () => {
      const result = await gateway.handleTyping(mockClient, mockTypingPayload);

      // Should emit typing event
      expect(mockServer.to).toHaveBeenCalledWith(
        RoomNameFactory.conversationRoom(mockConversationId),
      );
      expect(mockServer.emit).toHaveBeenCalledWith(
        MessageEventType.USER_TYPING,
        expect.objectContaining({
          conversationId: mockConversationId,
          user: expect.objectContaining({
            id: mockUserId,
            username: mockUsername,
          }),
        }),
      );

      // Should return success
      expect(result.success).toBeTruthy();
    });
  });

  describe('handleStopTyping', () => {
    const mockTypingPayload = {
      conversationId: mockConversationId,
    };

    it('should return error if validation fails', async () => {
      const result = await gateway.handleStopTyping(mockClient, {
        conversationId: '', // Invalid ID
      });

      expect(result.success).toBeFalsy();
      expect(result.error).toEqual({
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
      });
    });

    it('should emit stop typing event on success', async () => {
      const result = await gateway.handleStopTyping(
        mockClient,
        mockTypingPayload,
      );

      // Should emit stop typing event
      expect(mockServer.to).toHaveBeenCalledWith(
        RoomNameFactory.conversationRoom(mockConversationId),
      );
      expect(mockServer.emit).toHaveBeenCalledWith(
        MessageEventType.USER_STOPPED_TYPING,
        expect.objectContaining({
          conversationId: mockConversationId,
          userId: mockUserId,
        }),
      );

      // Should return success
      expect(result.success).toBeTruthy();
    });
  });

  describe('handleMarkAsRead', () => {
    const mockReadPayload = {
      messageId: mockMessageId,
      conversationId: mockConversationId,
    };

    beforeEach(() => {
      jest.spyOn(gateway as any, 'isThrottled').mockReturnValue(false);
    });

    it('should return error if validation fails', async () => {
      const result = await gateway.handleMarkAsRead(mockClient, {
        messageId: '', // Invalid ID
        conversationId: mockConversationId,
      });

      expect(result.success).toBeFalsy();
      expect(result.error).toEqual({
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
      });
    });

    it('should return success without processing if throttled', async () => {
      (gateway as any).isThrottled.mockReturnValue(true);

      const result = await gateway.handleMarkAsRead(
        mockClient,
        mockReadPayload,
      );

      expect(result.success).toBeTruthy();
      expect((result as SuccessResponse).data).toEqual(
        expect.objectContaining({ throttled: true }),
      );
      expect(messageService.markMessageAsRead).not.toHaveBeenCalled();
    });

    it('should mark message as read and emit event on success', async () => {
      const result = await gateway.handleMarkAsRead(
        mockClient,
        mockReadPayload,
      );

      // Should mark message as read
      expect(messageService.markMessageAsRead).toHaveBeenCalledWith(
        mockReadPayload.messageId,
        mockUserId,
      );

      // Should emit read event
      expect(mockServer.to).toHaveBeenCalledWith(
        RoomNameFactory.conversationRoom(mockConversationId),
      );
      expect(mockServer.emit).toHaveBeenCalledWith(
        MessageEventType.MESSAGE_READ,
        expect.objectContaining({
          messageId: mockMessageId,
          userId: mockUserId,
          conversationId: mockConversationId,
        }),
      );

      // Should return success
      expect(result.success).toBeTruthy();
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
      messageValidator.validateReaction.mockReturnValue('Validation error');

      const result = await gateway.handleReactionAdded(
        mockClient,
        mockReactionPayload,
      );

      expect(result.success).toBeFalsy();
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('should add reaction and emit event on success', async () => {
      messageValidator.validateReaction.mockReturnValue(null);
      messageService.addReaction.mockResolvedValue({
        ...mockMessage,
        status: MessageStatus.DELIVERED,
      });

      const result = await gateway.handleReactionAdded(
        mockClient,
        mockReactionPayload,
      );

      // Should add reaction
      expect(messageService.addReaction).toHaveBeenCalledWith(
        mockReactionPayload.messageId,
        mockUserId,
        mockReactionPayload.emoji,
      );

      // Should emit reaction event
      expect(mockServer.to).toHaveBeenCalledWith(
        RoomNameFactory.conversationRoom(mockConversationId),
      );
      expect(mockServer.emit).toHaveBeenCalledWith(
        MessageEventType.REACTION_ADDED,
        expect.objectContaining({
          messageId: mockMessageId,
          userId: mockUserId,
          username: mockUsername,
          emoji: mockReactionPayload.emoji,
        }),
      );

      // Should return success
      expect(result.success).toBeTruthy();
    });
  });

  describe('handleReactionRemoved', () => {
    const mockReactionPayload = {
      messageId: mockMessageId,
      emoji: '👍',
    };

    it('should return error if validation fails', async () => {
      messageValidator.validateReaction.mockReturnValue('Validation error');

      const result = await gateway.handleReactionRemoved(
        mockClient,
        mockReactionPayload,
      );

      expect(result.success).toBeFalsy();
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('should remove reaction and emit event on success', async () => {
      messageValidator.validateReaction.mockReturnValue(null);
      messageService.removeReaction.mockResolvedValue({
        ...mockMessage,
        status: MessageStatus.DELIVERED,
      });

      const result = await gateway.handleReactionRemoved(
        mockClient,
        mockReactionPayload,
      );

      // Should remove reaction
      expect(messageService.removeReaction).toHaveBeenCalledWith(
        mockReactionPayload.messageId,
        mockUserId,
        mockReactionPayload.emoji,
      );

      // Should emit reaction removal event
      expect(mockServer.to).toHaveBeenCalledWith(
        RoomNameFactory.conversationRoom(mockConversationId),
      );
      expect(mockServer.emit).toHaveBeenCalledWith(
        MessageEventType.REACTION_REMOVED,
        expect.objectContaining({
          messageId: mockMessageId,
          userId: mockUserId,
          emoji: mockReactionPayload.emoji,
        }),
      );

      // Should return success
      expect(result.success).toBeTruthy();
    });
  });
});
