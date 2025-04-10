import { Test, TestingModule } from '@nestjs/testing';
import { ParticipantEventHandler } from './participants.events';
import { ConversationService } from '../../../conversations/services/conversation.service';
import { PinoLogger } from 'nestjs-pino';
import { Server } from 'socket.io';
import { MessageEventType } from '../../events/message-events';

describe('ParticipantEventHandler', () => {
  let handler: ParticipantEventHandler;
  let conversationService: jest.Mocked<ConversationService>;
  let logger: jest.Mocked<PinoLogger>;
  let mockServer: jest.Mocked<Server>;

  const mockUserId = 'user-123';
  const mockConversationId = 'conv-123';
  const mockClientId = 'client-123';

  const mockClient: any = {
    id: mockClientId,
    data: {
      user: {
        id: mockUserId,
        tenantId: 'tenant-123',
      },
    },
    join: jest.fn(),
    leave: jest.fn(),
  };

  beforeEach(async () => {
    mockServer = {
      to: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      socketsJoin: jest.fn(),
      fetchSockets: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParticipantEventHandler,
        {
          provide: ConversationService,
          useValue: {
            validateAccess: jest.fn(),
            addParticipantsToGroup: jest.fn(),
            removeParticipantsFromGroup: jest.fn(),
            updateParticipantLastActive: jest.fn(),
          },
        },
        {
          provide: PinoLogger,
          useValue: {
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get<ParticipantEventHandler>(ParticipantEventHandler);
    conversationService = module.get(
      ConversationService,
    ) as jest.Mocked<ConversationService>;
    logger = module.get(PinoLogger) as jest.Mocked<PinoLogger>;
  });

  describe('participantAdded', () => {
    it('should return error for invalid payload', async () => {
      const result = await handler.participantAdded(
        mockClient,
        { conversationId: mockConversationId, participantIds: [] },
        mockServer,
      );

      expect(result.success).toBeFalsy();
      expect(result.error).toStrictEqual({
        code: 'VALIDATION_ERROR',
        message: 'Invalid participant data',
      });
    });

    it('should successfully add participants', async () => {
      const payload = {
        conversationId: mockConversationId,
        participantIds: ['user2', 'user3'],
      };

      conversationService.addParticipantsToGroup.mockResolvedValue({
        id: mockConversationId,
        participants: [],
      } as any);

      const result = await handler.participantAdded(
        mockClient,
        payload,
        mockServer,
      );

      expect(result.success).toBeTruthy();
      expect(conversationService.addParticipantsToGroup).toHaveBeenCalledWith(
        mockConversationId,
        payload.participantIds,
        mockUserId,
      );
      expect(mockServer.to).toHaveBeenCalled();
      expect(mockServer.emit).toHaveBeenCalledWith(
        MessageEventType.PARTICIPANTS_UPDATED,
        expect.any(Object),
      );
    });
  });

  describe('participantRemoved', () => {
    it('should return error for invalid payload', async () => {
      const result = await handler.participantRemoved(
        mockClient,
        { conversationId: mockConversationId, participantIds: [] },
        mockServer,
      );

      expect(result.success).toBeFalsy();
      expect(result.error).toStrictEqual({
        code: 'VALIDATION_ERROR',
        message: 'Invalid participant data',
      });
    });

    it('should successfully remove participants', async () => {
      const payload = {
        conversationId: mockConversationId,
        participantIds: ['user2'],
      };

      conversationService.removeParticipantsFromGroup.mockResolvedValue({
        id: mockConversationId,
        participants: [],
      } as any);

      mockServer.in.mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue([{ leave: jest.fn() }]),
      } as any);

      const result = await handler.participantRemoved(
        mockClient,
        payload,
        mockServer,
      );

      expect(result.success).toBeTruthy();
      expect(
        conversationService.removeParticipantsFromGroup,
      ).toHaveBeenCalledWith(
        mockConversationId,
        payload.participantIds,
        mockUserId,
      );
      expect(mockServer.to).toHaveBeenCalled();
      expect(mockServer.emit).toHaveBeenCalledWith(
        MessageEventType.PARTICIPANTS_UPDATED,
        expect.any(Object),
      );
    });
  });

  describe('joinConversation', () => {
    it('should deny access when user does not have permission', async () => {
      conversationService.validateAccess.mockResolvedValue(false);

      const result = await handler.joinConversation(
        mockClient,
        mockConversationId,
      );

      expect(result.success).toBeFalsy();
      expect(result.error).toStrictEqual({
        code: 'ACCESS_DENIED',
        message: 'You do not have access to this conversation',
      });
    });

    it('should successfully join conversation', async () => {
      conversationService.validateAccess.mockResolvedValue(true);

      const result = await handler.joinConversation(
        mockClient,
        mockConversationId,
      );

      expect(result.success).toBeTruthy();
      expect(mockClient.join).toHaveBeenCalled();
      expect(
        conversationService.updateParticipantLastActive,
      ).toHaveBeenCalledWith(mockUserId, mockConversationId);
    });
  });

  describe('leaveConversation', () => {
    it('should successfully leave conversation', async () => {
      const result = await handler.leaveConversation(
        mockClient,
        mockConversationId,
      );

      expect(result.success).toBeTruthy();
      expect(mockClient.leave).toHaveBeenCalled();

      if ('data' in result) {
        expect(result.data.conversationId).toBe(mockConversationId);
      }
    });
  });
});
