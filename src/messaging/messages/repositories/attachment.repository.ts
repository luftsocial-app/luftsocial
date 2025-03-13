import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  AttachmentEntity,
  AttachmentType,
} from '../entities/attachment.entity';

@Injectable()
export class AttachmentRepository extends Repository<AttachmentEntity> {
  private readonly logger = new Logger(AttachmentRepository.name);

  constructor(private readonly dataSource: DataSource) {
    super(AttachmentEntity, dataSource.createEntityManager());
  }

  /**
   * Find attachments by message ID
   */
  async findByMessageId(messageId: string): Promise<AttachmentEntity[]> {
    try {
      return await this.find({
        where: { messageId },
        order: { createdAt: 'ASC' },
      });
    } catch (error) {
      this.logger.error(
        `Error finding attachments by message ID: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find attachments by type and message ID
   */
  async findByTypeAndMessageId(
    type: AttachmentType,
    messageId: string,
  ): Promise<AttachmentEntity[]> {
    try {
      return await this.find({
        where: { type, messageId },
        order: { createdAt: 'ASC' },
      });
    } catch (error) {
      this.logger.error(
        `Error finding attachments by type and message: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find attachments by user's sent messages
   */
  async findByUserId(userId: string): Promise<AttachmentEntity[]> {
    try {
      return await this.createQueryBuilder('attachment')
        .innerJoin('attachment.message', 'message')
        .where('message.senderId = :userId', { userId })
        .getMany();
    } catch (error) {
      this.logger.error(
        `Error finding attachments by user ID: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update attachment processing status
   */
  async markAsProcessed(id: string, metadata: any): Promise<void> {
    try {
      await this.update(
        { id },
        {
          metadata: {
            ...metadata,
            isProcessed: true,
          },
        },
      );
    } catch (error) {
      this.logger.error(
        `Error marking attachment as processed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find unprocessed attachments
   */
  async findUnprocessed(): Promise<AttachmentEntity[]> {
    try {
      return await this.createQueryBuilder('attachment')
        .where(
          `(attachment.metadata->>'isProcessed')::boolean = false OR attachment.metadata->>'isProcessed' IS NULL`,
        )
        .getMany();
    } catch (error) {
      this.logger.error(
        `Error finding unprocessed attachments: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
