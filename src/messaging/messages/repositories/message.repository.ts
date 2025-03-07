import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository, FindOptionsWhere } from 'typeorm';
import { MessageEntity } from '../entities/message.entity';
import { MessageQueryDto } from '../../conversations/dto/conversation.dto';

@Injectable()
export class MessageRepository extends Repository<MessageEntity> {
  private readonly logger = new Logger(MessageRepository.name);

  constructor(private readonly dataSource: DataSource) {
    super(MessageEntity, dataSource.createEntityManager());
  }

  /**
   * Find messages by conversation ID with pagination and filtering
   */
  async findByConversation(
    conversationId: string, 
    query: MessageQueryDto
  ): Promise<MessageEntity[]> {
    try {
      const queryBuilder = this.createQueryBuilder('message')
        .where('message.conversationId = :conversationId', { conversationId });
      
      if (query.senderId) {
        queryBuilder.andWhere('message.senderId = :senderId', { senderId: query.senderId });
      }
      
      if (query.searchTerm) {
        queryBuilder.andWhere('message.content ILIKE :searchTerm', { 
          searchTerm: `%${query.searchTerm}%` 
        });
      }
      
      if (!query.includeDeleted) {
        queryBuilder.andWhere('message.isDeleted = :isDeleted', { isDeleted: false });
      }
      
      return queryBuilder
        .orderBy(`message.${query.sortBy || 'createdAt'}`, query.sortOrder || 'DESC')
        .skip((query.page - 1) * query.limit)
        .take(query.limit)
        .getMany();
    } catch (error) {
      this.logger.error(`Error finding messages by conversation: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find message by ID with tenant validation
   */
  async findByIdAndTenant(id: string, tenantId: string): Promise<MessageEntity | null> {
    try {
      return this.findOne({
        where: { id, tenantId },
        relations: ['sender', 'attachments']
      });
    } catch (error) {
      this.logger.error(`Error finding message by ID and tenant: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get message history for a user
   */
  async findMessageHistory(userId: string): Promise<MessageEntity[]> {
    try {
      return this.find({
        where: [{ senderId: userId }],
        order: { createdAt: 'ASC' },
      });
    } catch (error) {
      this.logger.error(`Error finding message history: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get thread replies for a parent message
   */
  async findThreadReplies(parentMessageId: string): Promise<MessageEntity[]> {
    try {
      return this.find({
        where: { parentMessageId },
        order: { createdAt: 'ASC' },
        relations: ['sender', 'attachments']
      });
    } catch (error) {
      this.logger.error(`Error finding thread replies: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Mark message as deleted (soft delete)
   */
  async markAsDeleted(id: string, userId: string): Promise<void> {
    try {
      await this.update(
        { id },
        { 
          isDeleted: true, 
          deletedBy: userId,
          deletedAt: new Date()
        }
      );
    } catch (error) {
      this.logger.error(`Error marking message as deleted: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get unread message count for user in a conversation
   */
  async getUnreadCount(conversationId: string, userId: string): Promise<number> {
    try {
      const queryBuilder = this.createQueryBuilder('message')
        .where('message.conversationId = :conversationId', { conversationId })
        .andWhere('message.isDeleted = :isDeleted', { isDeleted: false });
      
      // Use JSON path query to check if user hasn't read the message
      queryBuilder.andWhere(`NOT (message.readBy::jsonb ? :userId)`, { userId });
      
      return queryBuilder.getCount();
    } catch (error) {
      this.logger.error(`Error getting unread count: ${error.message}`, error.stack);
      throw error;
    }
  }
} 