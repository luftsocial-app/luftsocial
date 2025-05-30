import { Injectable, Logger } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { MessageInboxEntity } from '../entities/inbox.entity';
import { appError } from 'lib/helpers/error';
import { BaseRepository } from '../../../common/repositories/base.repository';


@Injectable()
export class MessageInboxRepository extends BaseRepository<MessageInboxEntity> {
  private readonly logger = new Logger(MessageInboxRepository.name);

  constructor(private readonly dataSource: DataSource) {
    super(MessageInboxEntity, dataSource.createEntityManager());
  }

  async createForRecipients(
    recipients: { userId: string }[],
    senderId: string,
    messageId: string,
    conversationId: string,
  ): Promise<MessageInboxEntity[]> {
    try {
      const inboxes = recipients
        .filter((user) => user.userId !== senderId)
        .map((user) =>
          this.create({
            recipientId: user.userId,
            messageId,
            conversationId,
          }),
        );
      return await this.save(inboxes);
    } catch (error) {
      this.logger.error(
        `Error creating inbox for recipients: ${error.message}`,
        error.stack,
      );
      throw appError(error);
    }
  }

  async findUnreadByUserAndConversations(
    userId: string,
    conversationIds: string[],
  ): Promise<MessageInboxEntity[]> {
    try {
      const data = await this.find({
        where: {
          recipientId: userId,
          conversationId: In(conversationIds),
          read: false,
        },
        relations: ['message'],
        order: { createdAt: 'ASC' },
      });
      return data;
    } catch (error) {
      this.logger.error(
        `Error finding unread inbox for user and conversations: ${error.message}`,
        error.stack,
      );
      throw appError(error);
    }
  }



  

}
