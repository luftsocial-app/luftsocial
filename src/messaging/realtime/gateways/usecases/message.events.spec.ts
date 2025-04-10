import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'socket.io';
import { MessageService } from '../../../messages/services/message.service';
import { MessageValidatorService } from '../../services/message-validator.service';
import { WebsocketHelpers } from '../../utils/websocket.helpers';
import { MessageEventHandler } from './message.events';
import { MessageResponseDto } from '../../../messages/dto/message-response.dto';

describe('MessageEventHandler', () => {
  let handler: MessageEventHandler;
  let messageValidatorService: jest.Mocked<MessageValidatorService>;
  let messageService: jest.Mocked<MessageService>;
  let websocketHelpers: jest.Mocked<WebsocketHelpers>;
  let server: jest.Mocked<Server>;

  beforeEach(async () => {
    messageValidatorService = {
      validateReaction: jest.fn(),
    } as any;

    messageService = {
      removeReaction: jest.fn(),
    } as any;

    websocketHelpers = {
      isThrottled: jest.fn(),
    } as any;

    server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageEventHandler,
        { provide: MessageValidatorService, useValue: messageValidatorService },
        { provide: MessageService, useValue: messageService },
        { provide: WebsocketHelpers, useValue: websocketHelpers },
      ],
    }).compile();

    handler = module.get<MessageEventHandler>(MessageEventHandler);
  });

  describe('reactionRemoved', () => {
    const mockClient = {
      data: {
        user: {
          id: 'user123',
          username: 'testuser',
        },
      },
    };

    const mockPayload = {
      messageId: 'message123',
      emoji: '👍',
    };

    it('should successfully remove a reaction', async () => {
      messageValidatorService.validateReaction.mockReturnValue(null);
      messageService.removeReaction.mockResolvedValue({
        id: 'message123',
        conversationId: 'conv123',
      } as unknown as MessageResponseDto);

      const result = await handler.reactionRemoved(
        mockClient as any,
        mockPayload,
        server,
      );

      expect(messageValidatorService.validateReaction).toHaveBeenCalledWith(
        mockPayload,
      );
      expect(messageService.removeReaction).toHaveBeenCalledWith(
        mockPayload.messageId,
        mockClient.data.user.id,
        mockPayload.emoji,
      );
      expect(server.to).toHaveBeenCalledWith('conversation:conv123');
      expect(server.emit).toHaveBeenCalledWith(
        'reactionRemoved',
        expect.objectContaining({
          messageId: 'message123',
          emoji: '👍',
          userId: mockClient.data.user.id,
          timestamp: expect.any(Date),
        }),
      );
      expect(result.success).toBe(true);
    });

    it('should return error on validation failure', async () => {
      const validationError = 'Invalid reaction payload';
      messageValidatorService.validateReaction.mockReturnValue(validationError);

      const result = await handler.reactionRemoved(
        mockClient as any,
        mockPayload,
        server,
      );

      expect(messageValidatorService.validateReaction).toHaveBeenCalledWith(
        mockPayload,
      );
      expect(messageService.removeReaction).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result).toStrictEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid reaction payload',
        },
        success: false,
      });
    });
  });
});
