import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { MessageRepository } from '../repositories/message.repository';
import { AttachmentRepository } from '../repositories/attachment.repository';
import { MessageStatus } from '../../shared/enums/message-type.enum';
import { MessageQueryDto } from '../../conversations/dto/conversation.dto';
import { UpdateMessageDto } from '../dto/message.dto';
import { MessageEntity } from '../entities/message.entity';
import { ConversationService } from '../../conversations/services/conversation.service';
import {
  MessageResponseDto,
  MessageWithRelationsDto,
  MessageListResponseDto,
  AttachmentResponseDto,
} from '../dto/message-response.dto';
import { PinoLogger } from 'nestjs-pino';
import { TenantService } from '../../../user-management/tenant.service';
import { ContentSanitizer } from '../../shared/utils/content-sanitizer';

@Injectable()
export class MessageService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly attachmentRepository: AttachmentRepository,
    private readonly conversationService: ConversationService,
    private readonly tenantService: TenantService,
    private readonly contentSanitizer: ContentSanitizer,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(MessageService.name);
  }

  // Helper method to map entity to DTO
  private mapToMessageDto(
    message: MessageEntity,
    userId?: string,
  ): MessageResponseDto {
    const dto = new MessageResponseDto();
    dto.id = message.id;
    dto.conversationId = message.conversationId;
    dto.content = message.content;
    dto.senderId = message.senderId;
    dto.parentMessageId = message.parentMessageId;
    dto.status = message.status;
    dto.reactions = message.metadata?.reactions
      ? Object.entries(message.metadata.reactions).map(([userId, emoji]) => ({
          userId,
          emoji,
          createdAt: new Date(),
        }))
      : [];
    dto.editHistory = message.editHistory || [];
    dto.createdAt = message.createdAt;
    dto.updatedAt = message.updatedAt;

    // Improved readBy mapping using entity helper method
    dto.readBy = message.readBy || {};
    dto.isRead = userId ? !!message.readBy?.[userId] : false;

    // Improved edit history mapping
    dto.isEdited = message.isEdited;
    dto.metadata = {
      editHistory:
        message.metadata?.editHistory?.map((edit) => ({
          content: edit.content,
          editedAt: edit.editedAt,
          editorId: edit.editorId,
        })) || [],
      reactions: message.metadata?.reactions || {},
    };

    return dto;
  }

  private async mapToMessageWithRelationsDto(
    message: MessageEntity,
    userId?: string,
  ): Promise<MessageWithRelationsDto> {
    const baseDto = this.mapToMessageDto(message, userId);
    const withRelations = new MessageWithRelationsDto();

    // Copy all properties from the base DTO
    Object.assign(withRelations, baseDto);

    // Add attachments if any
    const attachments = await this.attachmentRepository.findByMessageId(
      message.id,
    );
    withRelations.attachments = attachments.map((attachment) => {
      const attachmentDto = new AttachmentResponseDto();
      attachmentDto.id = attachment.id;
      attachmentDto.fileName = attachment.fileName;
      attachmentDto.fileSize = attachment.fileSize;
      attachmentDto.mimeType = attachment.mimeType;

      // Fix missing properties
      attachmentDto.url = attachment.url;
      attachmentDto.processingStatus = attachment.processingStatus;
      attachmentDto.createdAt = attachment.createdAt;
      return attachmentDto;
    });

    // Count replies if it's a parent message
    const replies = await this.messageRepository.findThreadReplies(message.id);
    const replyCount = replies ? replies.length : 0;
    withRelations.replyCount = replyCount;

    return withRelations;
  }

  async createMessage(
    conversationId: string,
    content: string,
    senderId: string,
    parentMessageId?: string,
  ): Promise<MessageResponseDto> {
    try {
      const tenantId = this.tenantService.getTenantId();

      // Sanitize content before saving
      const sanitizedContent = this.contentSanitizer.sanitize(content);

      if (!sanitizedContent) {
        throw new BadRequestException('Message content is invalid');
      }

      const hasAccess = await this.conversationService.validateAccess(
        conversationId,
        senderId,
        tenantId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('No access to this conversation');
      }

      if (parentMessageId) {
        const parentMessage = await this.messageRepository.findByIdAndTenant(
          parentMessageId,
          tenantId,
        );

        if (!parentMessage) {
          throw new NotFoundException('Parent message not found');
        }

        if (parentMessage.conversationId !== conversationId) {
          throw new BadRequestException(
            'Parent message must be in the same conversation',
          );
        }
      }

      const message = this.messageRepository.create({
        conversationId,
        content: sanitizedContent,
        senderId,
        parentMessageId,
        tenantId,
        status: MessageStatus.SENT,
      });

      const savedMessage = await this.messageRepository.save(message);
      await this.conversationService.updateLastMessageTimestamp(conversationId);

      this.logger.debug(
        `Message created: ${savedMessage.id} in conversation: ${conversationId}`,
      );
      return this.mapToMessageDto(savedMessage, senderId);
    } catch (error) {
      this.logger.error(
        `Failed to create message: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateMessageStatus(
    messageId: string,
    status: MessageStatus,
  ): Promise<void> {
    try {
      const tenantId = this.tenantService.getTenantId();
      const message = await this.messageRepository.findByIdAndTenant(
        messageId,
        tenantId,
      );

      if (!message) {
        throw new NotFoundException(`Message with ID ${messageId} not found`);
      }

      await this.messageRepository.update(
        { id: messageId, tenantId },
        { status },
      );

      this.logger.debug(`Message ${messageId} status updated to: ${status}`);
    } catch (error) {
      this.logger.error(
        `Failed to update message status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getMessages(
    conversationId: string,
    query: MessageQueryDto,
  ): Promise<MessageListResponseDto> {
    try {
      const messages = await this.messageRepository.findByConversation(
        conversationId,
        query,
      );

      const total = messages.length;
      const { page = 1, limit = 20 } = query;
      const paginatedMessages = messages.slice(
        (page - 1) * limit,
        page * limit,
      );

      const messageDtos = await Promise.all(
        paginatedMessages.map((message) =>
          this.mapToMessageDto(message, query.userId),
        ),
      );

      const response = new MessageListResponseDto();
      response.messages = messageDtos;
      response.total = total;
      response.page = page;
      response.pageSize = limit;

      if (query.userId) {
        response.unreadCount = await this.getUnreadCount(
          conversationId,
          query.userId,
        );
      }

      this.logger.debug(
        `Retrieved ${messages.length} messages from conversation: ${conversationId}`,
      );
      return response;
    } catch (error) {
      this.logger.error(
        `Failed to get messages: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getMessageHistory(userId: string): Promise<MessageResponseDto[]> {
    try {
      const messages = await this.messageRepository.findMessageHistory(userId);
      return messages.map((message) => this.mapToMessageDto(message, userId));
    } catch (error) {
      this.logger.error(
        `Failed to get message history: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateMessage(
    messageId: string,
    updateData: UpdateMessageDto,
    userId: string,
  ): Promise<MessageResponseDto> {
    try {
      const tenantId = this.tenantService.getTenantId();
      const message = await this.messageRepository.findByIdAndTenant(
        messageId,
        tenantId,
      );

      if (!message) {
        throw new NotFoundException(`Message with ID ${messageId} not found`);
      }

      if (message.senderId !== userId) {
        throw new ForbiddenException('You can only edit your own messages');
      }

      if (message.isDeleted) {
        throw new BadRequestException('Cannot edit deleted messages');
      }

      // Sanitize updated content
      const sanitizedContent = this.contentSanitizer.sanitize(
        updateData.content,
      );
      if (!sanitizedContent) {
        throw new BadRequestException('Message content is invalid');
      }

      // Use entity helper method for edit history
      message.addEditHistoryEntry(message.content, userId);
      message.content = sanitizedContent;
      message.updatedAt = new Date();

      const updatedMessage = await this.messageRepository.save(message);
      this.logger.debug(`Message ${messageId} updated by user: ${userId}`);
      return this.mapToMessageDto(updatedMessage, userId);
    } catch (error) {
      this.logger.error(
        `Failed to update message: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    try {
      const tenantId = this.tenantService.getTenantId();
      const message = await this.messageRepository.findByIdAndTenant(
        messageId,
        tenantId,
      );

      if (!message) {
        throw new NotFoundException(`Message with ID ${messageId} not found`);
      }

      if (message.senderId !== userId) {
        throw new ForbiddenException('You can only delete your own messages');
      }

      await this.messageRepository.markAsDeleted(messageId, userId);
      this.logger.debug(
        `Message ${messageId} marked as deleted by user: ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete message: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async addReaction(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<MessageResponseDto> {
    try {
      const tenantId = this.tenantService.getTenantId();
      const message = await this.messageRepository.findByIdAndTenant(
        messageId,
        tenantId,
      );

      if (!message) {
        throw new NotFoundException(`Message with ID ${messageId} not found`);
      }

      if (message.isDeleted) {
        throw new BadRequestException('Cannot react to deleted messages');
      }

      message.metadata.reactions = message.metadata.reactions || {};
      message.metadata.reactions[userId] = emoji;
      const updatedMessage = await this.messageRepository.save(message);

      this.logger.debug(
        `Reaction added to message ${messageId} by user: ${userId}`,
      );
      return this.mapToMessageDto(updatedMessage, userId);
    } catch (error) {
      this.logger.error(
        `Failed to add reaction: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async removeReaction(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<MessageResponseDto> {
    try {
      const tenantId = this.tenantService.getTenantId();
      const message = await this.messageRepository.findByIdAndTenant(
        messageId,
        tenantId,
      );

      if (!message) {
        throw new NotFoundException(`Message with ID ${messageId} not found`);
      }

      message.removeReaction(userId, emoji);
      const updatedMessage = await this.messageRepository.save(message);

      this.logger.info(
        `Reaction removed from message ${messageId} by user: ${userId}`,
      );
      return this.mapToMessageDto(updatedMessage, userId);
    } catch (error) {
      this.logger.error(
        `Failed to remove reaction: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getAttachments(messageId: string): Promise<AttachmentResponseDto[]> {
    try {
      const tenantId = this.tenantService.getTenantId();
      const message = await this.messageRepository.findByIdAndTenant(
        messageId,
        tenantId,
      );

      if (!message) {
        throw new NotFoundException(`Message with ID ${messageId} not found`);
      }

      const attachments =
        await this.attachmentRepository.findByMessageId(messageId);

      const attachmentDtos = attachments.map((attachment) => {
        const dto = new AttachmentResponseDto();
        dto.id = attachment.id;
        dto.fileName = attachment.fileName;
        dto.fileSize = attachment.fileSize;
        dto.mimeType = attachment.mimeType;
        dto.url = attachment.url;
        dto.processingStatus = attachment.processingStatus;
        dto.createdAt = attachment.createdAt;
        return dto;
      });

      this.logger.debug(
        `Retrieved ${attachments.length} attachments for message: ${messageId}`,
      );
      return attachmentDtos;
    } catch (error) {
      this.logger.error(
        `Failed to get attachments: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getThreadReplies(
    parentMessageId: string,
  ): Promise<MessageResponseDto[]> {
    try {
      const parentMessage = await this.messageRepository.findOne({
        where: { id: parentMessageId },
      });

      if (!parentMessage) {
        throw new NotFoundException(
          `Parent message with ID ${parentMessageId} not found`,
        );
      }

      const replies =
        await this.messageRepository.findThreadReplies(parentMessageId);
      return replies.map((reply) => this.mapToMessageDto(reply));
    } catch (error) {
      this.logger.error(
        `Failed to get thread replies: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findMessageById(
    messageId: string,
    userId?: string,
  ): Promise<MessageWithRelationsDto> {
    try {
      const tenantId = this.tenantService.getTenantId();
      const message = await this.messageRepository.findByIdAndTenant(
        messageId,
        tenantId,
      );

      if (!message) {
        throw new NotFoundException(`Message with ID ${messageId} not found`);
      }

      return this.mapToMessageWithRelationsDto(message, userId);
    } catch (error) {
      this.logger.error(
        `Failed to find message: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    try {
      const tenantId = this.tenantService.getTenantId();
      const message = await this.messageRepository.findByIdAndTenant(
        messageId,
        tenantId,
      );

      if (!message) {
        throw new NotFoundException(`Message with ID ${messageId} not found`);
      }

      // Use entity helper method for marking as read
      message.markAsRead(userId);
      await this.messageRepository.save(message);

      this.logger.debug(
        `Message ${messageId} marked as read by user: ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to mark message as read: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getUnreadCount(
    conversationId: string,
    userId: string,
  ): Promise<number> {
    try {
      const tenantId = this.tenantService.getTenantId();

      // Validate conversation access
      const hasAccess = await this.conversationService.validateAccess(
        conversationId,
        userId,
        tenantId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('No access to this conversation');
      }

      const count = await this.messageRepository.getUnreadCount(
        conversationId,
        userId,
      );

      this.logger.debug(
        `Retrieved unread count for user ${userId} in conversation ${conversationId}: ${count}`,
      );
      return count;
    } catch (error) {
      this.logger.error(
        `Failed to get unread count: ${error.message}`,
        error.stack,
      );
      // Rethrow specific exceptions
      if (error instanceof ForbiddenException) {
        throw error;
      }
      // Wrap unknown errors
      throw new BadRequestException(
        `Failed to get unread count: ${error.message}`,
      );
    }
  }
}
