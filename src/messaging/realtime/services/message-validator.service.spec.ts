import { Test, TestingModule } from '@nestjs/testing';
import { MessageValidatorService } from './message-validator.service';
import { Logger } from '@nestjs/common';
import {
  MessageEventPayload,
  MessageUpdatePayload,
  ReactionPayload,
} from '../events/message-events';
import { PinoLogger } from 'nestjs-pino';
import { ContentSanitizer } from '../../shared/utils/content-sanitizer';

describe('MessageValidatorService', () => {
  let service: MessageValidatorService;
  let contentSanitizer: jest.Mocked<ContentSanitizer>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageValidatorService,
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
          provide: Logger,
          useValue: {
            error: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: ContentSanitizer,
          useValue: {
            sanitize: jest.fn().mockReturnValue('sanitized content'),
            sanitizeRealtimeMessage: jest.fn().mockReturnValue({
              isValid: true,
              sanitized: 'sanitized content',
            }),
            sanitizeMetadata: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MessageValidatorService>(MessageValidatorService);
    contentSanitizer = module.get(ContentSanitizer);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateNewMessage', () => {
    beforeEach(() => {
      contentSanitizer.sanitizeRealtimeMessage.mockReturnValue({
        isValid: true,
        sanitized: 'Sanitized content',
      });
    });

    it('should return null for valid message payload', () => {
      const payload: MessageEventPayload = {
        conversationId: 'conv-123',
        content: 'Hello world',
      };

      contentSanitizer.sanitizeRealtimeMessage.mockReturnValue({
        isValid: true,
        sanitized: 'Hello world',
      });

      const result = service.validateNewMessage(payload);
      expect(result).toBeNull();
    });

    it('should return error when conversationId is missing', () => {
      const payload: MessageEventPayload = {
        conversationId: '',
        content: 'Hello world',
      };

      const result = service.validateNewMessage(payload);
      expect(result).toBe('Conversation ID is required');
    });

    it('should return error when content is missing', () => {
      const payload: MessageEventPayload = {
        conversationId: 'conv-123',
        content: '',
      };

      const result = service.validateNewMessage(payload);
      expect(result).toBe('Message content is required');
    });

    it('should return error when content exceeds maximum length', () => {
      const payload: MessageEventPayload = {
        conversationId: 'conv-123',
        content: 'a'.repeat(5001), // MAX_MESSAGE_LENGTH + 1
      };

      const result = service.validateNewMessage(payload);
      expect(result).toBe('Message exceeds maximum length of 5000 characters');
    });

    it('should return error when content is less than minimum length', () => {
      const payload: MessageEventPayload = {
        conversationId: 'conv-123',
        content: '',
      };

      const result = service.validateNewMessage(payload);
      expect(result).toBe('Message content is required');
    });

    it('should return error message when an exception occurs', () => {
      // Create a payload that will cause an error when accessed
      const payload = null;

      const result = service.validateNewMessage(payload);
      expect(result).toBe('Invalid message format');
    });
  });

  describe('validateMessageUpdate', () => {
    beforeEach(() => {
      contentSanitizer.sanitize.mockReturnValue('Sanitized content');
    });

    it('should return null for valid update payload', () => {
      const payload: MessageUpdatePayload = {
        messageId: 'msg-123',
        content: 'Updated content',
      };

      const result = service.validateMessageUpdate(payload);
      expect(result).toBeNull();
      expect(contentSanitizer.sanitize).toHaveBeenCalledWith('Updated content');
    });

    it('should return error when messageId is missing', () => {
      const payload: MessageUpdatePayload = {
        messageId: '',
        content: 'Updated content',
      };

      const result = service.validateMessageUpdate(payload);
      expect(result).toBe('Message ID is required');
    });

    it('should return error when content is missing', () => {
      const payload: MessageUpdatePayload = {
        messageId: 'msg-123',
        content: '',
      };

      const result = service.validateMessageUpdate(payload);
      expect(result).toBe('Updated content is required');
    });

    it('should return error mesage when content exceeds maximum length', () => {
      const payload: MessageUpdatePayload = {
        messageId: 'msg-123',
        content: 'a'.repeat(5001), // MAX_MESSAGE_LENGTH + 1
      };

      jest.spyOn(contentSanitizer, 'sanitize').mockReturnValue(payload.content);

      const result = service.validateMessageUpdate(payload);
      expect(result).toBe('Message exceeds maximum length of 5000 characters');
    });

    it('should return error when content is less than minimum length', () => {
      const payload: MessageUpdatePayload = {
        messageId: 'msg-123',
        content: '',
      };

      const result = service.validateMessageUpdate(payload);
      expect(result).toBe('Updated content is required');
    });

    it('should return error when sanitization fails', () => {
      const payload: MessageUpdatePayload = {
        messageId: 'msg-123',
        content: 'Bad content',
      };

      contentSanitizer.sanitize.mockReturnValue('');

      const result = service.validateMessageUpdate(payload);
      expect(result).toBe('Message contains forbidden content');
    });

    it('should return error message when an exception occurs', () => {
      // Create a payload that will cause an error when accessed
      const payload = null;

      const result = service.validateMessageUpdate(payload);
      expect(result).toBe('Invalid update format');
    });

    it('should return error when content sanitization fails', () => {
      const payload: MessageUpdatePayload = {
        messageId: 'msg-123',
        content: '<script>alert("xss")</script>',
      };

      contentSanitizer.sanitize.mockReturnValueOnce(null);

      const result = service.validateMessageUpdate(payload);
      expect(result).toBe('Message contains forbidden content');
    });
  });

  describe('validateReaction', () => {
    it('should return null for valid reaction payload with emoji', () => {
      const payload: ReactionPayload = {
        messageId: 'msg-123',
        emoji: '👍',
      };

      const result = service.validateReaction(payload);
      expect(result).toBeNull();
    });

    it('should return error when messageId is missing', () => {
      const payload: ReactionPayload = {
        messageId: '',
        emoji: '👍',
      };

      const result = service.validateReaction(payload);
      expect(result).toBe('Message ID is required');
    });

    it('should return error when emoji is missing', () => {
      const payload: ReactionPayload = {
        messageId: 'msg-123',
        emoji: '',
      };

      const result = service.validateReaction(payload);
      expect(result).toBe('Emoji is required');
    });

    it('should return error for invalid emoji format', () => {
      const payload: ReactionPayload = {
        messageId: 'msg-123',
        emoji: 'this-is-not-an-emoji-and-is-too-long',
      };

      const result = service.validateReaction(payload);
      expect(result).toBe('Invalid emoji format');
    });

    it('should accept short text emoji alternatives', () => {
      const payload: ReactionPayload = {
        messageId: 'msg-123',
        emoji: ':)',
      };

      const result = service.validateReaction(payload);
      expect(result).toBeNull();
    });

    it('should return error message when an exception occurs', () => {
      // Create a payload that will cause an error when accessed
      const payload = null;

      const result = service.validateReaction(payload);
      expect(result).toBe('Invalid reaction format');
    });
  });
});
