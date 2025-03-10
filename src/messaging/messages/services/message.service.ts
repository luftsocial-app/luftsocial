import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { TenantService } from '../../../database/tenant.service';
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
import { Not, Like } from 'typeorm';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly attachmentRepository: AttachmentRepository,
    @Inject(forwardRef(() => ConversationService))
    private readonly conversationService: ConversationService,
    private readonly tenantService: TenantService,
  ) {}

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
    dto.reactions = message.reactions || [];
    dto.editHistory = message.editHistory || [];
    dto.createdAt = message.createdAt;
    dto.updatedAt = message.updatedAt;

    // Fix readBy mapping - convert object to array of IDs
    if (message.readBy) {
      dto.readBy = Object.keys(message.readBy);
      dto.isRead = userId ? !!message.readBy[userId] : false;
    } else {
      dto.readBy = [];
      dto.isRead = false;
    }

    // Set isEdited based on either the entity's isEdited flag or the presence of edit history
    dto.isEdited =
      message.isEdited || (message.metadata?.editHistory?.length ?? 0) > 0;
    dto.metadata = {
      editHistory:
        message.metadata?.editHistory?.map((edit) => edit.content) || [],
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
        content,
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

      message.metadata.editHistory = message.metadata.editHistory || [];
      message.metadata.editHistory.push({
        content: message.content,
        editedAt: new Date(),
      });
      message.isEdited = true;
      message.content = updateData.content;
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

      this.logger.debug(
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

      if (!message.readBy) message.readBy = {};
      message.readBy[userId] = new Date();
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
      const count = await this.messageRepository.count({
        where: {
          conversationId,
          isDeleted: false,
          readBy: Not(Like(`%${userId}%`)),
        },
      });

      this.logger.debug(
        `Retrieved unread count for user ${userId} in conversation ${conversationId}: ${count}`,
      );
      return count;
    } catch (error) {
      this.logger.error(
        `Failed to get unread count: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
