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
import { MediaStorageService } from '../../../asset-management/media-storage/media-storage.service';
import { AttachmentStatus } from '../entities/attachment.entity';
import { UploadType } from '../../../common/enums/upload.enum';
import { QueryRunner } from 'typeorm';
import { DataSource } from 'typeorm';
import { lookup } from 'mime-types';
import { AttachmentEntity } from '../entities/attachment.entity';
import { MessageInboxEntity } from '../entities/inbox.entity';
import { mapMediaTypeToAttachmentType } from '../../../common/helpers/app';
import {
  MessageEventType,
  RoomNameFactory,
} from '../../../messaging/realtime/events/message-events';
import { Inject, forwardRef } from '@nestjs/common';
import { MessagingGateway } from '../../../messaging/realtime/gateways/messaging.gateway';
import { ParticipantRepository } from '../../conversations/repositories/participant.repository';
import { MessageInboxRepository } from '../repositories/inbox.repository';
import { appError } from 'lib/helpers/error';

@Injectable()
export class MessageService {
  constructor(
    @Inject(forwardRef(() => MessagingGateway))
    private readonly messagingGateway: MessagingGateway,
    private readonly messageRepository: MessageRepository,
    private readonly participantRepository: ParticipantRepository,
    private readonly inboxRepository: MessageInboxRepository,
    private readonly attachmentRepository: AttachmentRepository,
    private readonly conversationService: ConversationService,
    private readonly tenantService: TenantService,
    private readonly contentSanitizer: ContentSanitizer,
    private readonly mediaStorageService: MediaStorageService,
    private readonly logger: PinoLogger,
    private readonly dataSource: DataSource,
  ) {
    this.logger.setContext(MessageService.name);
  }

  // Helper method to map entity to DTO
  private mapToMessageDto(
    message: MessageEntity,
    userId?: string,
    attachments?: AttachmentEntity[],
  ): MessageResponseDto {
    const dto = new MessageResponseDto();

    // Basic message properties
    Object.assign(dto, {
      id: message.id,
      conversationId: message.conversationId,
      content: message.content,
      senderId: message.senderId,
      parentMessageId: message.parentMessageId,
      status: message.status,
      editHistory: message.editHistory || [],
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      readBy: message.readBy || {},
      isRead: userId ? !!message.readBy?.[userId] : false,
      isEdited: message.isEdited,
    });

    // Map reactions if any
    dto.reactions = message.metadata?.reactions
      ? Object.entries(message.metadata.reactions).map(
          ([reactUserId, emoji]) => ({
            userId: reactUserId,
            emoji,
            createdAt: new Date(),
          }),
        )
      : [];

    // Map attachments if provided or available on message
    if (attachments?.length) {
      dto.attachments = this.mapAttachmentsToDto(attachments);
    } else if (message.attachments?.length) {
      dto.attachments = this.mapAttachmentsToDto(message.attachments);
    }

    return dto;
  }

  private mapAttachmentsToDto(
    attachments: AttachmentEntity[],
  ): AttachmentResponseDto[] {
    return attachments.map((attachment) => {
      const dto = new AttachmentResponseDto();
      Object.assign(dto, {
        id: attachment.id,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType,
        type: attachment.type,
        status: attachment.status,
        publicUrl: attachment.publicUrl,
        processingStatus: attachment.status,
        createdAt: attachment.createdAt,
      });
      return dto;
    });
  }

  private async mapToMessageWithRelationsDto(
    message: MessageEntity,
    userId?: string,
  ): Promise<MessageWithRelationsDto> {
    const baseDto = this.mapToMessageDto(message, userId);
    const withRelations = new MessageWithRelationsDto();

    // Copy base properties
    Object.assign(withRelations, baseDto);

    // Load and map attachments if not already loaded
    if (!baseDto.attachments?.length) {
      const attachments = await this.attachmentRepository.findByMessageId(
        message.id,
      );
      withRelations.attachments = this.mapAttachmentsToDto(attachments);
    }

    // Count thread replies
    const replies = await this.messageRepository.findThreadReplies(message.id);
    withRelations.replyCount = replies?.length || 0;

    return withRelations;
  }

  async createMessage(
    conversationId: string,
    content: string,
    senderId: string,
    parentMessageId?: string,
    uploadSessionId?: string,
  ): Promise<MessageResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const tenantId = this.tenantService.getTenantId();

      if (!content?.trim() && !uploadSessionId) {
        throw new BadRequestException(
          'Message must have either content or attachment',
        );
      }

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
        throw new ForbiddenException(
          'User does not have access to this conversation',
        );
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

      const savedMessage = await queryRunner.manager.save(message);

      let attachments: AttachmentEntity[] = [];

      if (uploadSessionId) {
        attachments = await this.processAttachments(
          uploadSessionId,
          savedMessage.id,
          senderId,
          conversationId,
          queryRunner,
        );
      }

      const recipients =
        await this.participantRepository.findByConversationId(conversationId);
      const inboxEntities = this.inboxRepository.createForRecipients(
        recipients,
        senderId,
        savedMessage.id,
        conversationId,
      );
      await queryRunner.manager.save(inboxEntities);

      await this.conversationService.updateLastMessageTimestamp(conversationId);

      await queryRunner.commitTransaction();

      this.logger.debug(
        `Message created: ${savedMessage.id} in conversation: ${conversationId}`,
      );
      // await this.emitMessageEvent('message:created', savedMessage, conversationId);
      // Emit event for websocket to broadcast
      return this.mapToMessageDto(savedMessage, senderId, attachments);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to create message: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
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
      // Ensure page and limit are numbers with defaults
      const page = query.page ? Number(query.page) : 1;
      const limit = query.limit ? Number(query.limit) : 20;

      // Get all messages matching the query (repository handles pagination)
      const messages = await this.messageRepository.findByConversation(
        conversationId,
        {
          ...query,
          page,
          limit,
        },
      );

      // Map messages to DTOs
      const messageDtos = await Promise.all(
        messages.map((message) => this.mapToMessageDto(message, query.userId)),
      );

      // Get total count for the current query
      const total = await this.messageRepository.count({
        where: {
          conversationId,
          ...(query.senderId && { senderId: query.senderId }),
          ...(!query.includeDeleted && { isDeleted: false }),
        },
      });

      // Prepare response
      const response = new MessageListResponseDto();
      response.messages = messageDtos;
      response.total = total;
      response.page = page;
      response.pageSize = limit;

      // Get unread count if userId is provided
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

      const room = RoomNameFactory.conversationRoom(message.conversationId);
      this.messagingGateway.server
        .to(room)
        .emit(MessageEventType.MESSAGE_DELETED, {
          id: messageId,
        });
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

      const room = RoomNameFactory.conversationRoom(message.conversationId);
      this.messagingGateway.server
        .to(room)
        .emit(MessageEventType.REACTION_ADDED, {
          id: messageId,
          userId,
          emoji,
        });

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

      const room = RoomNameFactory.conversationRoom(message.conversationId);
      this.messagingGateway.server
        .to(room)
        .emit(MessageEventType.REACTION_REMOVED, {
          id: messageId,
          userId,
          emoji,
        });

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

      return attachments;
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

      await this.inboxRepository.update(
        {
          messageId,
          recipientId: userId,
        },
        { readAt: new Date(), read: true },
      );

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

  // Prepare → Upload → Finalize → Attach to Message

  // MESSAGE ATTACHMENT
  async prepareAttachment(
    userId: string,
    fileName: string,
    conversationId: string,
    uploadSessionId: string,
  ) {
    // Let verify conversation access

    await this.conversationService.validateAccess(
      conversationId,
      userId,
      this.tenantService.getTenantId(),
    );

    // Detect MIME type from file extension
    const detectedMimeType = lookup(fileName);
    if (!detectedMimeType) {
      this.logger.debug(`Failed to detect MIME type for ${fileName}`);
      throw new BadRequestException('Unsupported file type');
    }

    const presigned = await this.mediaStorageService.generatePreSignedUrl(
      userId,
      fileName,
      detectedMimeType,
      undefined,
      undefined,
      UploadType.MESSAGE,
      conversationId,
    );

    // Create pending attachment record
    const attachment = this.attachmentRepository.create({
      fileName,
      mimeType: detectedMimeType,
      fileKey: presigned.key,
      type: mapMediaTypeToAttachmentType(detectedMimeType),
      userId,
      status: AttachmentStatus.PENDING,
      tenantId: this.tenantService.getTenantId(),
      publicUrl: presigned.cdnUrl,
      metadata: {
        originalName: fileName,
      },
      messageId: null,
      conversationId,
      uploadSessionId,
    });

    await this.attachmentRepository.save(attachment);

    return {
      presignedUrl: presigned.preSignedUrl,
      attachmentId: attachment.id,
      fileKey: presigned.key,
      cdnUrl: presigned.cdnUrl,
      conversationId,
    };
  }

  async confirmAttachment(attachmentId: string) {
    const attachment = await this.attachmentRepository.findOneBy({
      id: attachmentId,
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    console.log('attachment............................:', attachment);

    try {
      // let get file metadata including size
      const metadata = await this.mediaStorageService.getFileMetadata(
        attachment.fileKey,
      );

      console.log('metadata..........:', metadata);

      // let verify S3 upload
      const isValid = await this.mediaStorageService.verifyUpload(
        attachment.fileKey,
      );

      if (!isValid) {
        throw new BadRequestException('File verification failed');
      }

      console.log('isvalid..................:', isValid);

      // let update the attachment status with file size
      attachment.status = AttachmentStatus.COMPLETED;
      attachment.fileKey = attachment.fileKey;
      attachment.fileSize = metadata.ContentLength;
      attachment.uploadVerified = true;

      await this.attachmentRepository.save(attachment);

      return attachment;
    } catch (error) {
      this.logger.error(
        `Error finalizing attachment: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to finalize attachment: ${error.message}`,
      );
    }
  }

  private async processAttachments(
    uploadSessionId: string,
    messageId: string,
    senderId: string,
    conversationId: string,
    queryRunner: QueryRunner,
  ): Promise<AttachmentEntity[]> {
    const attachments = await this.attachmentRepository
      .createQueryBuilder('attachment', queryRunner)
      .where('attachment.uploadSessionId = :uploadSessionId', {
        uploadSessionId,
      })
      .andWhere('attachment.userId = :userId', { userId: senderId })
      .andWhere('attachment.conversationId = :conversationId', {
        conversationId,
      })
      .andWhere('attachment.status = :status', {
        status: AttachmentStatus.COMPLETED,
      })
      .andWhere('attachment.uploadVerified = :verified', { verified: true })
      .andWhere('attachment.messageId IS NULL')
      .getMany();

    if (attachments.length === 0) {
      throw new BadRequestException(
        'No valid attachments found for this session.',
      );
    }

    await Promise.all(
      attachments.map((att) => {
        att.messageId = messageId;
        att.uploadSessionId = null;
        return queryRunner.manager.save(att);
      }),
    );
    return attachments;
  }

  // In MessageService:
  async getUnreadInbox(
    userId: string,
    conversationIds: string[],
  ): Promise<MessageInboxEntity[]> {
    try {
      const unread =
        await this.inboxRepository.findUnreadByUserAndConversations(
          userId,
          conversationIds,
        );
      return unread;
    } catch (error) {
      this.logger.error(
        `Error finding unread inbox for user and conversations: ${error.message}`,
        error.stack,
      );
      throw appError(error);
    }
  }

  async fetchAllInbox(userId: string, query: any = {}) {
    try {
      // Parse all query params here
      const { page, limit, order, ...filters } = query;

      const where = {
        // always enforce this for fetchall
        recipientId: userId,
        ...filters,
      };
      const options = {
        relations: ['message'],
        order: order ? JSON.parse(order) : { createdAt: 'DESC' },
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
      };

      return await this.inboxRepository.fetchAll(where, options);
    } catch (error) {
      this.logger.error(
        `Error finding all inbox for user and conversations: ${error.message}`,
        error.stack,
      );
      throw appError(error);
    }
  }

  async markMessageAsDelivered(
    messageId: string,
    recipientId: string,
    deliveredAt: Date = new Date(),
  ): Promise<void> {
    try {
      await this.dataSource.transaction(async (transactionalEntityManager) => {
        // Update the inbox entry
        const result = await transactionalEntityManager
          .createQueryBuilder()
          .update(MessageInboxEntity)
          .set({
            delivered: true,
            deliveredAt: deliveredAt,
            updatedAt: new Date(),
          })
          .where('message_id = :messageId', { messageId })
          .andWhere('recipient_id = :recipientId', { recipientId })
          .andWhere('delivered = :delivered', { delivered: false })
          .execute();

        if (result.affected === 0) {
          this.logger.warn(
            `Message ${messageId} for recipient ${recipientId} not found or already marked as delivered`,
          );
        }
      });
    } catch (error) {
      this.logger.error(
        `Error marking message ${messageId} as delivered for recipient ${recipientId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
