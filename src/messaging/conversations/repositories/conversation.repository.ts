import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ConversationEntity } from '../entities/conversation.entity';
import { ConversationType } from '../../shared/enums/conversation-type.enum';

@Injectable()
export class ConversationRepository extends Repository<ConversationEntity> {
  private readonly logger = new Logger(ConversationRepository.name);

  constructor(private readonly dataSource: DataSource) {
    super(ConversationEntity, dataSource.createEntityManager());
  }

  /**
   * Find conversation by ID with relations
   */
  async findByIdWithRelations(id: string, tenantId: string): Promise<ConversationEntity | null> {
    try {
      return this.findOne({
        where: { id, tenantId },
        relations: ['participants.user', 'messages'],
      });
    } catch (error) {
      this.logger.error(`Error finding conversation by ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find all conversations for a tenant
   */
  async findByTenant(tenantId: string): Promise<ConversationEntity[]> {
    try {
      return this.find({
        where: { tenantId },
        relations: ['participants', 'messages'],
      });
    } catch (error) {
      this.logger.error(`Error finding conversations by tenant: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find conversations by user ID
   */
  async findByUserId(userId: string, tenantId: string): Promise<ConversationEntity[]> {
    try {
      return this.createQueryBuilder('conversation')
        .innerJoin('conversation.participants', 'participant')
        .where('participant.userId = :userId', { userId })
        .andWhere('conversation.tenantId = :tenantId', { tenantId })
        .leftJoinAndSelect('conversation.messages', 'messages')
        .leftJoinAndSelect('conversation.participants', 'allParticipants')
        .leftJoinAndSelect('allParticipants.user', 'user')
        .orderBy('conversation.lastMessageAt', 'DESC')
        .getMany();
    } catch (error) {
      this.logger.error(`Error finding conversations by user ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find direct conversation between two users
   */
  async findDirectConversation(user1Id: string, user2Id: string, tenantId: string): Promise<ConversationEntity | null> {
    try {
      // This query finds conversations where both users are participants and it's a direct conversation
      const conversations = await this.createQueryBuilder('conversation')
        .innerJoin('conversation.participants', 'participant1')
        .innerJoin('conversation.participants', 'participant2')
        .where('participant1.userId = :user1Id', { user1Id })
        .andWhere('participant2.userId = :user2Id', { user2Id })
        .andWhere('conversation.type = :type', { type: ConversationType.DIRECT })
        .andWhere('conversation.tenantId = :tenantId', { tenantId })
        .getMany();

      // For direct chats, we should only have one result
      return conversations.length > 0 ? conversations[0] : null;
    } catch (error) {
      this.logger.error(`Error finding direct conversation: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update last message timestamp
   */
  async updateLastMessageTimestamp(id: string): Promise<void> {
    try {
      await this.update(
        { id },
        { lastMessageAt: new Date() }
      );
    } catch (error) {
      this.logger.error(`Error updating last message timestamp: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update conversation unread counts
   */
  async updateUnreadCount(id: string, userId: string, count: number): Promise<void> {
    try {
      const conversation = await this.findOne({ where: { id } });
      if (conversation) {
        conversation.unreadCounts[userId] = count;
        await this.save(conversation);
      }
    } catch (error) {
      this.logger.error(`Error updating unread count: ${error.message}`, error.stack);
      throw error;
    }
  }
}
