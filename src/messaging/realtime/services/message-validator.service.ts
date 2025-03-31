import { Injectable } from '@nestjs/common';
import {
  MessageEventPayload,
  MessageUpdatePayload,
  ReactionPayload,
} from '../events/message-events';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class MessageValidatorService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(MessageValidatorService.name);
  }
  private readonly MAX_MESSAGE_LENGTH = 5000;
  private readonly MIN_MESSAGE_LENGTH = 1;
  private readonly EMOJI_REGEX =
    /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])$/;

  validateNewMessage(payload: MessageEventPayload): string | null {
    try {
      if (!payload.conversationId) {
        return 'Conversation ID is required';
      }

      if (!payload.content) {
        return 'Message content is required';
      }

      if (payload.content.length > this.MAX_MESSAGE_LENGTH) {
        return `Message exceeds maximum length of ${this.MAX_MESSAGE_LENGTH} characters`;
      }

      if (payload.content.length < this.MIN_MESSAGE_LENGTH) {
        return 'Message content cannot be empty';
      }

      // Sanitize content for XSS (simplified - in a real app use a proper sanitizer)
      if (payload.content.includes('<script>')) {
        return 'Message contains forbidden content';
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Message validation error: ${error.message}`,
        error.stack,
      );
      return 'Invalid message format';
    }
  }

  validateMessageUpdate(payload: MessageUpdatePayload): string | null {
    try {
      if (!payload.messageId) {
        return 'Message ID is required';
      }

      if (!payload.content) {
        return 'Updated content is required';
      }

      if (payload.content.length > this.MAX_MESSAGE_LENGTH) {
        return `Message exceeds maximum length of ${this.MAX_MESSAGE_LENGTH} characters`;
      }

      if (payload.content.length < this.MIN_MESSAGE_LENGTH) {
        return 'Message content cannot be empty';
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Update validation error: ${error.message}`,
        error.stack,
      );
      return 'Invalid update format';
    }
  }

  validateReaction(payload: ReactionPayload): string | null {
    try {
      if (!payload.messageId) {
        return 'Message ID is required';
      }

      if (!payload.emoji) {
        return 'Emoji is required';
      }

      if (!this.EMOJI_REGEX.test(payload.emoji) && payload.emoji.length > 2) {
        return 'Invalid emoji format';
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Reaction validation error: ${error.message}`,
        error.stack,
      );
      return 'Invalid reaction format';
    }
  }
}
