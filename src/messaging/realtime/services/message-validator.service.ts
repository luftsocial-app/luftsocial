import { Injectable } from '@nestjs/common';
import {
  MessageEventPayload,
  MessageUpdatePayload,
  ReactionPayload,
} from '../events/message-events';
import { PinoLogger } from 'nestjs-pino';
import { ContentSanitizer } from '../../shared/utils/content-sanitizer';

@Injectable()
export class MessageValidatorService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contentSanitizer: ContentSanitizer,
  ) {
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

      if (payload.metadata) {
        const metadataSanitization =
          this.contentSanitizer.sanitizeRealtimeMessage(payload.metadata);
        if (!metadataSanitization.isValid) {
          return 'Message metadata contains forbidden elements';
        }
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

      // Sanitize the content
      const sanitizedContent = this.contentSanitizer.sanitize(payload.content);
      if (!sanitizedContent) {
        return 'Message contains forbidden content';
      }

      if (sanitizedContent.length > this.MAX_MESSAGE_LENGTH) {
        return `Message exceeds maximum length of ${this.MAX_MESSAGE_LENGTH} characters`;
      }

      if (sanitizedContent.length < this.MIN_MESSAGE_LENGTH) {
        return 'Message content cannot be empty';
      }

      // Sanitize metadata if present
      if (payload.metadata) {
        payload.metadata = this.contentSanitizer.sanitizeMetadata(
          payload.metadata,
        );
      }

      // Update the payload with sanitized content
      payload.content = sanitizedContent;

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
