import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../../entities/chats/message.entity';
import { TenantService } from '../../database/tenant.service';
import { MessageStatus } from '../../common/enums/messaging';
import { OperationStatus } from '../../common/enums/operation-status.enum';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    private tenantService: TenantService,
  ) {}

  async createMessage(
    conversationId: string,
    content: string,
  ): Promise<Message> {
    const message = this.messageRepo.create({
      conversationId,
      content,
      status: MessageStatus.SENT,
      tenantId: this.tenantService.getTenantId(),
    });
    return this.messageRepo.save(message);
  }

  async updateMessageStatus(
    messageId: string,
    status: MessageStatus,
  ): Promise<void> {
    await this.messageRepo.update(
      { id: messageId, tenantId: this.tenantService.getTenantId() },
      { status },
    );
  }

  async getMessages(conversationId: string, query: any): Promise<Message[]> {
    return this.messageRepo.find({
      where: {
        conversationId,
        tenantId: this.tenantService.getTenantId(),
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

  async updateMessage(
    messageId: string,
    updateData: { content: string },
    userId: string,
  ): Promise<Message> {
    const message = await this.messageRepo.findOne({
      where: {
        id: messageId,
        tenantId: this.tenantService.getTenantId(),
      },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    message.addEditHistory(message.content);

    message.content = updateData.content;

    return this.messageRepo.save(message);
  }
}
