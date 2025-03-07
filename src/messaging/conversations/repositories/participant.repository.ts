import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository, In } from 'typeorm';
import { ParticipantEntity } from '../entities/participant.entity';
import { ParticipantRole } from '../../shared/enums/participant-role.enum';

@Injectable()
export class ParticipantRepository extends Repository<ParticipantEntity> {
  private readonly logger = new Logger(ParticipantRepository.name);

  constructor(private readonly dataSource: DataSource) {
    super(ParticipantEntity, dataSource.createEntityManager());
  }

  /**
   * Find participants by conversation ID
   */
  async findByConversationId(conversationId: string): Promise<ParticipantEntity[]> {
    try {
      return this.find({
        where: { conversationId },
        relations: ['user'],
      });
    } catch (error) {
      this.logger.error(`Error finding participants by conversation ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find participant by user ID and conversation ID
   */
  async findByUserAndConversation(userId: string, conversationId: string): Promise<ParticipantEntity | null> {
    try {
      return this.findOne({
        where: {
          userId,
          conversationId,
        },
        relations: ['user', 'conversation'],
      });
    } catch (error) {
      this.logger.error(`Error finding participant by user and conversation: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find all conversations where user is a participant
   */
  async findConversationsByUserId(userId: string): Promise<ParticipantEntity[]> {
    try {
      return this.find({
        where: { userId, status: 'member' },
        relations: ['conversation'],
      });
    } catch (error) {
      this.logger.error(`Error finding conversations by user ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Check if user is admin or owner in a conversation
   */
  async isUserAdmin(userId: string, conversationId: string): Promise<boolean> {
    try {
      const participant = await this.findOne({
        where: {
          userId,
          conversationId,
          role: In([ParticipantRole.ADMIN, ParticipantRole.OWNER]),
        },
      });
      
      return !!participant;
    } catch (error) {
      this.logger.error(`Error checking if user is admin: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update participant's last active timestamp
   */
  async updateLastActive(userId: string, conversationId: string): Promise<void> {
    try {
      await this.update(
        { userId, conversationId },
        { lastActiveAt: new Date() }
      );
    } catch (error) {
      this.logger.error(`Error updating last active timestamp: ${error.message}`, error.stack);
      throw error;
    }
  }
} 