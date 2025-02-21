import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TenantService } from '../../database/tenant.service';
import {
  Conversation,
  ConversationType,
} from '../../entities/chats/conversation.entity';
import { Message } from '../../entities/chats/message.entity';
import { User } from '../../entities/users/user.entity';

interface CreateConversationDto {
  name?: string;
  type: ConversationType;
  participantIds: string[];
  isPrivate?: boolean;
  metadata?: {
    avatar?: string;
    isEncrypted?: boolean;
  };
  settings?: any;
}

@Injectable()
export class ChatService {
  constructor(
    private tenantService: TenantService,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createConversation(data: CreateConversationDto): Promise<Conversation> {
    const participants = await this.userRepository.findBy({
      id: In(data.participantIds),
    });

    const conversation = this.conversationRepository.create({
      name: data.name,
      type: data.type,
      participants,
      isPrivate: data.isPrivate,
      metadata: data.metadata,
      settings: data.settings,
      tenantId: this.tenantService.getTenantId(),
    });

    return await this.conversationRepository.save(conversation);
  }

  async getConversations(): Promise<Conversation[]> {
    return this.conversationRepository.find({
      where: { tenantId: this.tenantService.getTenantId() },
      relations: ['participants', 'messages'],
    });
  }

  async getConversationsByUserId(userId: string): Promise<Conversation[]> {
    return this.conversationRepository
      .createQueryBuilder('conversation')
      .innerJoin('conversation.participants', 'participant')
      .where('participant.id = :userId', { userId })
      .andWhere('conversation.tenantId = :tenantId', {
        tenantId: this.tenantService.getTenantId(),
      })
      .leftJoinAndSelect('conversation.messages', 'messages')
      .leftJoinAndSelect('conversation.participants', 'allParticipants')
      .getMany();
  }

  async createMessage(
    conversationId: string,
    content: string,
    senderId: string,
  ): Promise<Message> {
    const message = this.messageRepo.create({
      conversationId,
      content,
      senderId,
      tenantId: this.tenantService.getTenantId(),
    });

    const savedMessage = await this.messageRepo.save(message);

    // Update conversation's lastMessageAt
    await this.conversationRepository.update(
      { id: conversationId },
      { lastMessageAt: new Date() },
    );

    return savedMessage;
  }

  async validateAccess(
    conversationId: string,
    userId: string,
    tenantId: string,
  ): Promise<boolean> {
    const conversation = await this.conversationRepository.findOne({
      where: {
        id: conversationId,
        tenantId: tenantId,
      },
      relations: ['participants'],
    });

    if (!conversation) {
      return false;
    }

    return conversation.participants.some((p) => p.id === userId);
  }

  async createOrGetDirectChat(
    userId1: string,
    userId2: string,
  ): Promise<Conversation> {
    // Check if direct chat already exists between these users
    const existingChat = await this.conversationRepository
      .createQueryBuilder('conversation')
      .innerJoin('conversation.participants', 'participant')
      .where('conversation.type = :type', { type: ConversationType.DIRECT })
      .andWhere('participant.id IN (:...userIds)', {
        userIds: [userId1, userId2],
      })
      .andWhere('conversation.tenantId = :tenantId', {
        tenantId: this.tenantService.getTenantId(),
      })
      .groupBy('conversation.id')
      .having('COUNT(DISTINCT participant.id) = 2')
      .getOne();

    if (existingChat) {
      return existingChat;
    }

    // Create new direct chat
    const users = await this.userRepository.findBy({
      id: In([userId1, userId2]),
    });
    if (users.length !== 2) {
      throw new NotFoundException('One or both users not found');
    }

    const newConversation = this.conversationRepository.create({
      type: ConversationType.DIRECT,
      participants: users,
      tenantId: this.tenantService.getTenantId(),
    });

    return this.conversationRepository.save(newConversation);
  }

  async createGroupChat(
    name: string,
    participantIds: string[],
    creatorId: string,
  ): Promise<Conversation> {
    const participants = await this.userRepository.findBy({
      id: In(participantIds),
    });
    const creator = await this.userRepository.findOneBy({ id: creatorId });

    if (!creator || participants.length !== participantIds.length) {
      throw new NotFoundException('One or more users not found');
    }

    const conversation = this.conversationRepository.create({
      name,
      type: ConversationType.GROUP,
      participants,
      admins: [creator],
      tenantId: this.tenantService.getTenantId(),
    });

    return this.conversationRepository.save(conversation);
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: {
        id: conversationId,
        tenantId: this.tenantService.getTenantId(),
      },
      relations: ['participants', 'messages', 'admins'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  async addParticipantsToGroup(
    conversationId: string,
    newParticipantIds: string[],
    adminId: string,
  ): Promise<Conversation> {
    const conversation = await this.getConversation(conversationId);

    if (conversation.type !== ConversationType.GROUP) {
      throw new ConflictException('Cannot add participants to direct chat');
    }

    if (!conversation.admins.some((admin) => admin.id === adminId)) {
      throw new ConflictException('Only admins can add participants');
    }

    const newParticipants = await this.userRepository.findBy({
      id: In(newParticipantIds),
    });
    conversation.participants = [
      ...conversation.participants,
      ...newParticipants,
    ];

    return this.conversationRepository.save(conversation);
  }

  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
    });
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    message.markAsRead(userId);
    await this.messageRepo.save(message);

    // Update conversation unread count
    const conversation = await this.conversationRepository.findOne({
      where: { id: message.conversationId },
    });

    if (conversation) {
      conversation.unreadCounts[userId] = Math.max(
        (conversation.unreadCounts[userId] || 0) - 1,
        0,
      );
      await this.conversationRepository.save(conversation);
    }
  }

  async getUnreadCount(
    conversationId: string,
    userId: string,
  ): Promise<number> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    return conversation?.unreadCounts[userId] || 0;
  }
}
