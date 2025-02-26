import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../../entities/chats/message.entity';
import { MessageStatus } from '../../common/enums/messaging';
import { OperationStatus } from '../../common/enums/operation-status.enum';
import { TenantAwareRepository } from '../../tenant-aware-repo/tenant-aware.repos';

@Injectable()
export class MessageService {
  constructor(
    @Inject(`TENANT_AWARE_REPOSITORY_${Message.name}`)
    private readonly messageRepo: TenantAwareRepository<Message>,
  ) {}

  async createMessage(
    conversationId: string,
    content: string,
  ): Promise<Message> {
    const message = this.messageRepo.create({
      conversationId,
      content,
      status: MessageStatus.SENT,
    });
    return this.messageRepo.save(message);
  }

  async updateMessageStatus(
    messageId: string,
    status: MessageStatus,
  ): Promise<void> {
    await this.messageRepo.update(messageId, { status });
  }

  async getMessages(conversationId: string, query: any): Promise<Message[]> {
    return this.messageRepo.find({
      where: {
        conversationId,
        ...query,
      },
    });
  }

  async getMessageHistory(
    userId: string,
  ): Promise<{ data: Message[]; status: number }> {
    try {
      const messageHistory = await this.messageRepo.find({
        where: [{ senderId: userId }],
        order: { createdAt: 'ASC' },
      });
      if (messageHistory.length > 0) {
        return {
          status: OperationStatus.Success,
          data: messageHistory,
        };
      }
      return {
        status: OperationStatus.NotFound,
        data: [],
      };
    } catch (err) {
      throw new HttpException(err.message || err, HttpStatus.BAD_REQUEST);
    }
  }
}
