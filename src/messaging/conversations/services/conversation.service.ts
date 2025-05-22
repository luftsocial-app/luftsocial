import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConversationRepository } from '../repositories/conversation.repository';
import { ParticipantRepository } from '../repositories/participant.repository';
// Removed InjectRepository and Repository from typeorm, In might still be used by other repos
import { In } from 'typeorm'; 
// Removed User entity import as we're removing direct userRepository usage
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

    // @InjectRepository(User) // Removed userRepository
    // private userRepository: Repository<User>, 
  ) {
    this.logger.setContext(ConversationService.name);
  }

  async createConversation(
    data: CreateConversationDto,
  ): Promise<ConversationEntity> {
    const tenantId = await this.tenantService.getTenantId();
    const { validClerkUsers, invalidUserIds } = await this.userService.validateUsersAreInTenant(data.participantIds, tenantId);

    if (invalidUserIds.length > 0) {
      throw new NotFoundException(`One or more users are invalid, not found, or do not belong to the tenant: ${invalidUserIds.join(', ')}`);
    }
    if (validClerkUsers.length === 0) {
        throw new NotFoundException('No valid users found to create a conversation.');
    }
    
    // Ensure creator is part of the valid users if creatorId was in participantIds
    if (!validClerkUsers.some(u => u.id === data.creatorId)) {
        // This check is important if creatorId isn't guaranteed to be in participantIds or if validation might exclude them
        // If creatorId MUST be part of participantIds and be valid, this error is appropriate.
        // If creatorId is separate and also needs validation, it should be included in validateUsersAreInTenant call.
        // For now, assuming creatorId is one of the participantIds.
        throw new NotFoundException(`Creator (ID: ${data.creatorId}) is not among the valid participants for this tenant.`);
    }


    const conversation = this.conversationRepository.create({
      name: data.name,
      type: data.type,
      isPrivate: data.isPrivate,
      metadata: data.metadata,
      settings: data.settings,
      tenantId: tenantId,
    });

    const savedConversation =
      await this.conversationRepository.save(conversation);

    // Create participant records for all valid clerkUsers
    const participants = validClerkUsers.map((clerkUser) => {
      const isCreator = data.creatorId === clerkUser.id;
      return this.participantRepository.create({
        conversation: savedConversation,
        conversationId: savedConversation.id,
        // user: clerkUser, // Not assigning the full clerkUser to 'user' relation. Only userId.
        userId: clerkUser.id, // Use clerkUser.id for userId
        role: isCreator ? ParticipantRole.OWNER : ParticipantRole.MEMBER,
        status: 'member',
        tenantId: tenantId,
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
    userId1: string, // Current user, assumed to be valid and in tenant
    userId2: string, // Other user for the direct chat
  ): Promise<ConversationEntity> {
    const tenantId = await this.tenantService.getTenantId();

    // Validate userId2
    const { validClerkUsers: validatedUser2List, invalidUserIds: invalidUser2Ids } = 
      await this.userService.validateUsersAreInTenant([userId2], tenantId);

    if (invalidUser2Ids.length > 0 || validatedUser2List.length === 0) {
      throw new NotFoundException(`User ${userId2} not found in the tenant or is invalid.`);
    }
    const clerkUser2 = validatedUser2List[0]; // We only passed one ID

    // Check if direct chat already exists using Clerk IDs
    const existingChat =
      await this.conversationRepository.findDirectConversation(
        userId1, // Clerk ID of current user
        clerkUser2.id, // Clerk ID of other user
        tenantId,
      );

    if (existingChat) {
      return existingChat;
    }

    // Create new direct chat
    // We need clerkUser object for userId1 as well for consistency in participant creation
    // Assuming userId1 is the current authenticated user, already implicitly validated.
    // For participant creation, we'd ideally have clerkUser1 object.
    // If not readily available, a quick fetch might be needed, or use a simpler structure if possible.
    // Let's assume we can proceed with just userId1 for its participant record for now,
    // or if we had currentClerkUser object, we'd use it.
    // For this refactor, let's focus on using IDs and assume the local User entity is not directly populated.

    const conversation = this.conversationRepository.create({
      type: ConversationType.DIRECT,
      tenantId,
    });

    const savedConversation =
      await this.conversationRepository.save(conversation);
    
    // Create participants
    // Participant for userId1 (current user)
    const participant1 = this.participantRepository.create({
      conversation: savedConversation,
      conversationId: savedConversation.id,
      userId: userId1, // Clerk ID of current user
      role: ParticipantRole.MEMBER,
      status: 'member',
      tenantId,
    });

    // Participant for userId2 (clerkUser2)
    const participant2 = this.participantRepository.create({
      conversation: savedConversation,
      conversationId: savedConversation.id,
      userId: clerkUser2.id, // Clerk ID of other user
      role: ParticipantRole.MEMBER,
      status: 'member',
      tenantId,
    });

    const participants = [participant1, participant2];
    await this.participantRepository.save(participants);
    savedConversation.participants = participants; // Attach for return, though they might not have full 'user' objects

    return savedConversation;
  }

  async createGroupChat(
    name: string,
    participantIds: string[], // All user IDs for the group, including creator
    creatorId: string,
  ): Promise<ConversationEntity> {
    const tenantId = await this.tenantService.getTenantId();
    
    // Validate all participantIds including the creator
    const { validClerkUsers, invalidUserIds } = 
      await this.userService.validateUsersAreInTenant([...new Set([creatorId, ...participantIds])], tenantId);

    if (invalidUserIds.length > 0) {
      throw new NotFoundException(`One or more users are invalid, not found, or do not belong to the tenant: ${invalidUserIds.join(', ')}`);
    }
    if (validClerkUsers.length === 0) {
        throw new NotFoundException('No valid users found to create a group chat.');
    }
    
    // Ensure creator is among the valid users
    if (!validClerkUsers.some(u => u.id === creatorId)) {
        throw new NotFoundException(`Creator (ID: ${creatorId}) is not among the valid participants for this tenant or is invalid.`);
    }

    const conversation = this.conversationRepository.create({
      name,
      type: ConversationType.GROUP,
      tenantId: tenantId,
    });

    const savedConversation =
      await this.conversationRepository.save(conversation);

    // Create participants with creator as owner
    const participants = validClerkUsers.map((clerkUser) => {
      return this.participantRepository.create({
        conversation: savedConversation,
        conversationId: savedConversation.id,
        userId: clerkUser.id,
        role:
          clerkUser.id === creatorId
            ? ParticipantRole.OWNER
            : ParticipantRole.MEMBER,
        status: 'member',
        tenantId: tenantId,
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
