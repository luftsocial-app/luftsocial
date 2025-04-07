import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConversationRepository } from '../repositories/conversation.repository';
import { ParticipantRepository } from '../repositories/participant.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../../../user-management/entities/user.entity';
import { ConversationEntity } from '../entities/conversation.entity';
import {
  CreateConversationDto,
  UpdateConversationSettingsDto,
} from '../dto/conversation.dto';
import { ConversationType } from '../../shared/enums/conversation-type.enum';
import { ParticipantRole } from '../../shared/enums/participant-role.enum';
import {} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { UserService } from '../../../user-management/user.service';
import { TenantService } from '../../../user-management/tenant.service';

@Injectable()
export class ConversationService {
  constructor(
    private tenantService: TenantService,
    private conversationRepository: ConversationRepository,
    private participantRepository: ParticipantRepository,
    private userService: UserService,

    private readonly logger: PinoLogger,

    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    this.logger.setContext(ConversationService.name);
  }

  async createConversation(
    data: CreateConversationDto,
  ): Promise<ConversationEntity> {
    const users = await this.userRepository.findBy({
      id: In(data.participantIds),
    });

    if (users.length === 0) {
      throw new NotFoundException('No users found with the provided IDs');
    }

    const conversation = this.conversationRepository.create({
      name: data.name,
      type: data.type,
      isPrivate: data.isPrivate,
      metadata: data.metadata,
      settings: data.settings,
      tenantId: await this.tenantService.getTenantId(),
    });

    const savedConversation =
      await this.conversationRepository.save(conversation);

    // Create participant records for all users
    const participants = users.map((user) => {
      const isCreator = data.creatorId === user.id;
      return this.participantRepository.create({
        conversation: savedConversation,
        conversationId: savedConversation.id,
        user: user,
        userId: user.id,
        role: isCreator ? ParticipantRole.OWNER : ParticipantRole.MEMBER,
        status: 'member',
        tenantId: this.tenantService.getTenantId(),
      });
    });

    await this.participantRepository.save(participants);
    savedConversation.participants = participants;

    return savedConversation;
  }

  async getConversations(): Promise<ConversationEntity[]> {
    return this.conversationRepository.findByTenant(
      this.tenantService.getTenantId(),
    );
  }

  async getConversationsByUserId(
    userId: string,
  ): Promise<ConversationEntity[]> {
    return this.conversationRepository.findByUserId(
      userId,
      this.tenantService.getTenantId(),
    );
  }

  async validateAccess(
    conversationId: string,
    userId: string,
    tenantId: string,
  ): Promise<boolean> {
    const participant =
      await this.participantRepository.findByUserAndConversation(
        userId,
        conversationId,
      );

    return (
      !!participant &&
      participant.status === 'member' &&
      participant.conversation.tenantId === tenantId
    );
  }

  async createOrGetDirectChat(
    userId1: string,
    userId2: string,
  ): Promise<ConversationEntity> {
    const tenantId = this.tenantService.getTenantId();

    const checkUser2TenantId = await this.userService.findById(userId2);

    if (!checkUser2TenantId) {
      throw new NotFoundException('User 2 not found in the tenant');
    }

    // Check if direct chat already exists
    const existingChat =
      await this.conversationRepository.findDirectConversation(
        userId1,
        userId2,
        tenantId,
      );

    if (existingChat) {
      return existingChat;
    }

    // Create new direct chat
    const users = await this.userRepository.findBy({
      id: In([userId1, userId2]),
    });

    this.logger.info({ usersRepo: users });

    if (users.length !== 2) {
      throw new NotFoundException('One or both users not found');
    }

    const conversation = this.conversationRepository.create({
      type: ConversationType.DIRECT,
      tenantId,
    });

    const savedConversation =
      await this.conversationRepository.save(conversation);

    // Create participants
    const participants = users.map((user) => {
      return this.participantRepository.create({
        conversation: savedConversation,
        conversationId: savedConversation.id,
        user: user,
        userId: user.id,
        role: ParticipantRole.MEMBER,
        status: 'member',
        tenantId,
      });
    });

    await this.participantRepository.save(participants);
    savedConversation.participants = participants;

    return savedConversation;
  }

  async createGroupChat(
    name: string,
    participantIds: string[],
    creatorId: string,
  ): Promise<ConversationEntity> {
    const users = await this.userRepository.findBy({
      id: In([...participantIds, creatorId]),
    });

    const creator = users.find((user) => user.id === creatorId);

    if (!creator || users.length !== participantIds.length + 1) {
      throw new NotFoundException('One or more users not found');
    }

    const conversation = this.conversationRepository.create({
      name,
      type: ConversationType.GROUP,
      tenantId: this.tenantService.getTenantId(),
    });

    const savedConversation =
      await this.conversationRepository.save(conversation);

    // Create participants with creator as owner
    const participants = users.map((user) => {
      return this.participantRepository.create({
        conversation: savedConversation,
        conversationId: savedConversation.id,
        user: user,
        userId: user.id,
        role:
          user.id === creatorId
            ? ParticipantRole.OWNER
            : ParticipantRole.MEMBER,
        status: 'member',
        tenantId: this.tenantService.getTenantId(),
      });
    });

    await this.participantRepository.save(participants);
    savedConversation.participants = participants;

    return savedConversation;
  }

  async getConversation(conversationId: string): Promise<ConversationEntity> {
    const conversation =
      await this.conversationRepository.findByIdWithRelations(
        conversationId,
        this.tenantService.getTenantId(),
      );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  async addParticipantsToGroup(
    conversationId: string,
    newParticipantIds: string[],
    currentUserId: string,
  ): Promise<ConversationEntity> {
    const conversation = await this.getConversation(conversationId);

    if (conversation.type !== ConversationType.GROUP) {
      throw new ConflictException('Cannot add participants to direct chat');
    }

    // Check if current user is admin or owner
    const isAdmin = await this.participantRepository.isUserAdmin(
      currentUserId,
      conversationId,
    );

    if (!isAdmin) {
      throw new ForbiddenException('Only admins can add participants');
    }

    // Get users to add
    const newUsers = await this.userRepository.findBy({
      id: In(newParticipantIds),
    });

    // Create new participant records
    const existingParticipantUserIds = conversation.participants.map(
      (p) => p.userId,
    );
    const newParticipants = newUsers
      .filter((user) => !existingParticipantUserIds.includes(user.id))
      .map((user) => {
        return this.participantRepository.create({
          conversation,
          conversationId,
          user,
          userId: user.id,
          role: ParticipantRole.MEMBER,
          status: 'member',
          tenantId: this.tenantService.getTenantId(),
        });
      });

    if (newParticipants.length > 0) {
      await this.participantRepository.save(newParticipants);
      conversation.participants = [
        ...conversation.participants,
        ...newParticipants,
      ];
    }

    return conversation;
  }

  async updateConversationSettings(
    conversationId: string,
    settings: UpdateConversationSettingsDto,
    userId: string,
  ): Promise<ConversationEntity> {
    const conversation = await this.getConversation(conversationId);

    // Check if current user is participant
    const participant =
      await this.participantRepository.findByUserAndConversation(
        userId,
        conversationId,
      );

    if (!participant) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    // For group chats, only admins can update certain settings
    if (conversation.type === ConversationType.GROUP) {
      const isAdmin = await this.participantRepository.isUserAdmin(
        userId,
        conversationId,
      );

      // These settings can only be updated by admins
      const adminOnlySettings = ['name', 'isPrivate'];

      const hasAdminOnlySetting = Object.keys(settings).some((key) =>
        adminOnlySettings.includes(key),
      );

      if (hasAdminOnlySetting && !isAdmin) {
        throw new ForbiddenException('Only admins can update these settings');
      }
    }

    // Update the conversation
    Object.assign(conversation, settings);
    return this.conversationRepository.save(conversation);
  }

  async updateParticipantLastActive(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    try {
      await this.participantRepository.updateLastActive(userId, conversationId);
    } catch (error) {
      this.logger.warn(`Failed to update last active time: ${error.message}`);
    }
  }

  async isUserAdmin(userId: string, conversationId: string): Promise<boolean> {
    return this.participantRepository.isUserAdmin(userId, conversationId);
  }

  async updateLastMessageTimestamp(conversationId: string): Promise<void> {
    await this.conversationRepository.update(
      { id: conversationId },
      { lastMessageAt: new Date() },
    );
  }

  /**
   * Remove participants from a group conversation
   * Only admins and owners can remove participants
   * Owners cannot be removed
   */
  async removeParticipantsFromGroup(
    conversationId: string,
    participantIdsToRemove: string[],
    currentUserId: string,
  ): Promise<ConversationEntity> {
    const conversation = await this.getConversation(conversationId);

    if (conversation.type !== ConversationType.GROUP) {
      throw new ConflictException(
        'Cannot remove participants from direct chat',
      );
    }

    // Check if current user is admin or owner
    const isAdmin = await this.isUserAdmin(currentUserId, conversationId);

    if (!isAdmin) {
      throw new ForbiddenException('Only admins can remove participants');
    }

    // Find participants to remove
    const participantsToRemove = await this.participantRepository.find({
      where: {
        conversationId,
        userId: In(participantIdsToRemove),
      },
    });

    // Check if trying to remove an owner
    const ownersBeingRemoved = participantsToRemove.filter(
      (p) => p.role === ParticipantRole.OWNER,
    );

    if (ownersBeingRemoved.length > 0) {
      throw new ForbiddenException('Cannot remove the conversation owner');
    }

    if (participantsToRemove.length > 0) {
      // Remove participants
      await this.participantRepository.remove(participantsToRemove);

      // Update the conversation object by removing the participants
      const updatedParticipants = conversation.participants.filter(
        (p) => !participantIdsToRemove.includes(p.userId),
      );
      conversation.participants = updatedParticipants;
    }

    return conversation;
  }
}
