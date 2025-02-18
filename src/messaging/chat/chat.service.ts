import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantService } from '../../database/tenant.service';
import { Conversation } from '../../entities/chats/conversation.entity';
import { Message } from '../../entities/chats/message.entity';
import { CreateConversationDto } from '../dtos/conversation.dto';

@Injectable()
export class ChatService {
  constructor(
    private tenantService: TenantService,

    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}

  async createConversation(data: CreateConversationDto): Promise<Conversation> {
    const conversation = this.conversationRepo.create({
      ...data,
      tenantId: this.tenantService.getTenantId(),
    });
    return await this.conversationRepo.save(conversation);
  }

  async getConversations(): Promise<Conversation[]> {
    return this.conversationRepo.find({
      where: { tenantId: this.tenantService.getTenantId() },
    });
  }

  async getConversationsByUserId(userId: string): Promise<Conversation[]> {
    return this.conversationRepo.find({
      where: {
        tenantId: this.tenantService.getTenantId(),
        participantIds: { user: { id: userId } },
      },
      relations: ['participantIds', 'messages'],
    });
  }

  async createMessage(
    conversationId: string,
    content: string,
  ): Promise<Message> {
    const message = this.messageRepo.create({
      conversationId,
      content,
      tenantId: this.tenantService.getTenantId(),
    });
    return this.messageRepo.save(message);
  }

  async validateAccess(
    conversationId: string,
    userId: string,
    tenantId: string,
  ): Promise<boolean> {
    // Check if the conversation exists and belongs to the given tenant
    const conversation = await this.conversationRepo.findOne({
      where: {
        id: conversationId,
        tenantId: tenantId,
      },
      relations: ['participants'], // Assuming a relation exists
    });

    if (!conversation) {
      return false; // Conversation does not exist in this tenant
    }

    // Check if the user is a participant in the conversation
    return conversation.participantIds.some((p) => p.id === userId);
  }
}
