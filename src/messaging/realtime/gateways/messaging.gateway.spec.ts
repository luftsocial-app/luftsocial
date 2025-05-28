import { Test, TestingModule } from '@nestjs/testing';
import { MessagingGateway } from './messaging.gateway';
import { ConversationService } from '../../conversations/services/conversation.service';
import { MessageService } from '../../messages/services/message.service';
import { MessageValidatorService } from '../services/message-validator.service';
import { ConfigService } from '@nestjs/config';
import { Server } from 'socket.io';
import { MessageEventType, RoomNameFactory } from '../events/message-events';
import { MessageEntity } from '../../messages/entities/message.entity';
import { PinoLogger } from 'nestjs-pino';
import { ContentSanitizer } from '../../shared/utils/content-sanitizer';
import { ParticipantEventHandler } from './usecases/participants.events';
import { MessageEventHandler } from './usecases/message.events';
import { WebsocketHelpers } from '../utils/websocket.helpers';
import { TenantService } from '../../../user-management/tenant.service';

describe('MessagingGateway', () => {
  let gateway: MessagingGateway;
  let participantHandler: ParticipantEventHandler;
  let conversationService: jest.Mocked<ConversationService>;
  let messageService: jest.Mocked<MessageService>;
  let messageValidator: jest.Mocked<MessageValidatorService>;
  let configService: jest.Mocked<ConfigService>;
  let websocketHelpers: jest.Mocked<WebsocketHelpers>;
  let logger: PinoLogger;
  let mockServer: jest.Mocked<Server>;

  // Provide a minimal TenantRepository mock
  class MockTenantRepository {}

  const mockUserId = 'user-123';
  const mockUsername = 'testuser';
  const mockTenantId = 'tenant-123';
  const mockConversationId = 'conv-123';
  const mockMessageId = 'msg-123';
  const mockClientId = 'client-123';

  const mockClient: any = {
    id: mockClientId,
    data: {
      user: {
        id: mockUserId,
        sub: mockUserId,
        username: mockUsername,
        tenantId: mockTenantId,
      },
    },
    emit: jest.fn(),
    disconnect: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
  };

  const mockMessage = {
    id: mockMessageId,
    conversationId: mockConversationId,
    content: 'Test message',
    senderId: mockUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
    isEdited: false,
    parentMessageId: undefined,
    attachments: [],
    editHistory: [],
  } as unknown as MessageEntity;

  beforeEach(async () => {
    mockServer = {
      to: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      socketsJoin: jest.fn(),
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
      on: jest.fn(),
      onAny: jest.fn(),
    } as unknown as jest.Mocked<Server>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingGateway,
        ParticipantEventHandler,
        MessageEventHandler,
        WebsocketHelpers,
        ContentSanitizer,
        {
          provide: TenantService,
          useValue: {
            getTenantId: jest.fn(),
            setTenantId: jest.fn(),
          }
        },
        {
          provide: 'TenantRepository',
          useClass: MockTenantRepository
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
    }).compile();

    gateway = module.get<MessagingGateway>(MessagingGateway);
    participantHandler = module.get(ParticipantEventHandler);
    conversationService = module.get(ConversationService) as jest.Mocked<ConversationService>;
    messageService = module.get(MessageService) as jest.Mocked<MessageService>;
    messageValidator = module.get(MessageValidatorService) as jest.Mocked<MessageValidatorService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
    websocketHelpers = module.get(WebsocketHelpers) as jest.Mocked<WebsocketHelpers>;
    logger = module.get(PinoLogger);

    gateway.server = mockServer;
  });

  describe('handleJoinConversation', () => {
    it('should join conversation and emit success', async () => {
      conversationService.validateAccess.mockResolvedValue(true);
      conversationService.updateParticipantLastActive.mockResolvedValue(undefined);

      const result = await participantHandler.joinConversation(mockClient, mockConversationId);

      expect(conversationService.validateAccess).toHaveBeenCalledWith(
        mockConversationId,
        mockUserId,
        mockTenantId,
      );
      expect(mockClient.join).toHaveBeenCalledWith(RoomNameFactory.conversationRoom(mockConversationId));
      expect(result.success).toBeTruthy();
      expect(result.data).toMatchObject({
        conversationId: mockConversationId,
        room: RoomNameFactory.conversationRoom(mockConversationId),
      });
    });

    it('should return error if no access', async () => {
      conversationService.validateAccess.mockResolvedValue(false);

      const result = await participantHandler.joinConversation(mockClient, mockConversationId);

      expect(result.success).toBeFalsy();
      expect(result.error.code).toBe('ACCESS_DENIED');
    });
  });

  describe('participantAdded', () => {
    it('should add participants and emit update', async () => {
      const payload = { conversationId: mockConversationId, participantIds: ['user-b'] };
      const fakeConv = { id: mockConversationId, participants: [] };
      conversationService.addParticipantsToGroup.mockResolvedValue(fakeConv);

      const out = await participantHandler.participantAdded(mockClient, payload, mockServer);

      expect(conversationService.addParticipantsToGroup).toHaveBeenCalledWith(
        mockConversationId,
        ['user-b'],
        mockUserId,
      );
      expect(mockServer.to).toHaveBeenCalledWith(RoomNameFactory.conversationRoom(mockConversationId));
      expect(mockServer.emit).toHaveBeenCalledWith(
        MessageEventType.PARTICIPANTS_UPDATED,
        expect.objectContaining({
          conversationId: mockConversationId,
          action: 'added',
        }),
      );
      expect(out.success).toBeTruthy();
    });

    it('should return error for invalid payload', async () => {
      const payload = { conversationId: mockConversationId, participantIds: [] };
      const out = await participantHandler.participantAdded(mockClient, payload, mockServer);
      expect(out.success).toBeFalsy();
      expect(out.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('participantRemoved', () => {
    it('should remove participants and emit update', async () => {
      const payload = { conversationId: mockConversationId, participantIds: ['user-b'] };
      const fakeConv = { id: mockConversationId, participants: [{ id: 'user-a' }, { id: 'user-b' }] };
      conversationService.removeParticipantsFromGroup.mockResolvedValue(fakeConv);
      mockServer.in = jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue([{ leave: jest.fn() }]),
      } as any);

      const out = await participantHandler.participantRemoved(mockClient, payload, mockServer);

      expect(conversationService.removeParticipantsFromGroup).toHaveBeenCalledWith(
        mockConversationId,
        ['user-b'],
        mockUserId,
      );
      expect(mockServer.to).toHaveBeenCalledWith(RoomNameFactory.conversationRoom(mockConversationId));
      expect(mockServer.emit).toHaveBeenCalledWith(
        MessageEventType.PARTICIPANTS_UPDATED,
        expect.objectContaining({
          conversationId: mockConversationId,
          action: 'removed',
        }),
      );
      expect(out.success).toBeTruthy();
    });

    it('should return error for invalid payload', async () => {
      const payload = { conversationId: mockConversationId, participantIds: [] };
      const out = await participantHandler.participantRemoved(mockClient, payload, mockServer);
      expect(out.success).toBeFalsy();
      expect(out.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('leaveConversation', () => {
    it('should leave conversation room and return success', async () => {
      const out = await participantHandler.leaveConversation(mockClient, mockConversationId);
      expect(mockClient.leave).toHaveBeenCalledWith(RoomNameFactory.conversationRoom(mockConversationId));
      expect(out.success).toBeTruthy();
    });
  });
});