import { Test, TestingModule } from '@nestjs/testing';
import { ConversationController } from './conversation.controller';
import { ConversationService } from '../services/conversation.service';
import { ConversationEntity } from '../entities/conversation.entity';
import {
  CreateConversationDto,
  AddParticipantsDto,
  UpdateConversationSettingsDto,
} from '../dto/conversation.dto';
import { CreateMessageDto } from '../../messages/dto/message.dto';
import { ConversationType } from '../../shared/enums/conversation-type.enum';
import { MessageEntity } from '../../messages/entities/message.entity';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ParticipantRole } from '../../shared/enums/participant-role.enum';

describe('ConversationController', () => {
  let controller: ConversationController;
  let service: ConversationService;

  // Mock test data
  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    tenantId: 'tenant-123',
  };
  const mockOtherUserId = 'user-456';
  const mockConversationId = 'conv-123';

  const mockConversation: Partial<ConversationEntity> = {
    id: mockConversationId,
    name: 'Test Conversation',
    type: ConversationType.GROUP,
    tenantId: 'tenant-123',
    participants: [],
    messages: [],
    isPrivate: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDirectConversation: Partial<ConversationEntity> = {
    id: 'direct-123',
    type: ConversationType.DIRECT,
    tenantId: 'tenant-123',
    participants: [],
    messages: [],
    isPrivate: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreateGroupDto: CreateConversationDto = {
    name: 'New Group Chat',
    type: ConversationType.GROUP,
    participantIds: ['user-456', 'user-789'],
  };

  const mockAddParticipantsDto: AddParticipantsDto = {
    participantIds: ['user-789', 'user-101'],
  };

  const mockUpdateSettingsDto: UpdateConversationSettingsDto = {
    name: 'Updated Conversation',
    isPrivate: true,
    settings: {
      muteNotifications: true,
      enableReadReceipts: false,
    },
  };

  const mockCreateMessageDto: CreateMessageDto = {
    content: 'Hello, world!',
    conversationId: mockConversationId,
  };

  const mockMessage: Partial<MessageEntity> = {
    id: 'msg-123',
    content: 'Hello, world!',
    conversationId: mockConversationId,
    senderId: mockUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Define service mock
  const mockConversationService = {
    createOrGetDirectChat: jest.fn(),
    createGroupChat: jest.fn(),
    getConversationsByUserId: jest.fn(),
    getConversation: jest.fn(),
    addParticipantsToGroup: jest.fn(),
    updateConversationSettings: jest.fn(),
    createMessage: jest.fn(),
  };

  beforeEach(async () => {
    // Set up the testing module
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        {
          provide: ConversationService,
          useValue: mockConversationService,
        },
      ],
    }).compile();

    controller = module.get<ConversationController>(ConversationController);
    service = module.get<ConversationService>(ConversationService);

    // Reset mock implementation before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createOrGetDirectChat', () => {
    it('should create or get a direct chat with another user', async () => {
      mockConversationService.createOrGetDirectChat.mockResolvedValue(
        mockDirectConversation,
      );

      const result = await controller.createOrGetDirectChat(
        mockUser,
        mockOtherUserId,
      );

      expect(service.createOrGetDirectChat).toHaveBeenCalledWith(
        mockUser.id,
        mockOtherUserId,
      );
      expect(result).toEqual(mockDirectConversation);
    });

    it('should handle errors when creating direct chat', async () => {
      mockConversationService.createOrGetDirectChat.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        controller.createOrGetDirectChat(mockUser, 'invalid-user'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createGroupChat', () => {
    it('should create a new group chat', async () => {
      mockConversationService.createGroupChat.mockResolvedValue(
        mockConversation,
      );

      const result = await controller.createGroupChat(
        mockUser,
        mockCreateGroupDto,
      );

      expect(service.createGroupChat).toHaveBeenCalledWith(
        mockCreateGroupDto.name,
        mockCreateGroupDto.participantIds,
        mockUser.id,
      );
      expect(result).toEqual(mockConversation);
    });

    it('should handle errors when creating group chat', async () => {
      mockConversationService.createGroupChat.mockRejectedValue(
        new NotFoundException('One or more users not found'),
      );

      await expect(
        controller.createGroupChat(mockUser, {
          ...mockCreateGroupDto,
          participantIds: ['invalid-id'],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMyConversations', () => {
    it('should return all conversations for the current user', async () => {
      const mockConversations = [mockConversation, mockDirectConversation];
      mockConversationService.getConversationsByUserId.mockResolvedValue(
        mockConversations,
      );

      const result = await controller.getMyConversations(mockUser);

      expect(service.getConversationsByUserId).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(result).toEqual(mockConversations);
    });
  });

  describe('getConversation', () => {
    it('should return a specific conversation by ID', async () => {
      mockConversationService.getConversation.mockResolvedValue(
        mockConversation,
      );

      const result = await controller.getConversation(mockConversationId);

      expect(service.getConversation).toHaveBeenCalledWith(mockConversationId);
      expect(result).toEqual(mockConversation);
    });

    it('should handle errors when conversation is not found', async () => {
      mockConversationService.getConversation.mockRejectedValue(
        new NotFoundException('Conversation not found'),
      );

      await expect(controller.getConversation('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addParticipantsToConversation', () => {
    it('should add participants to a conversation', async () => {
      mockConversationService.addParticipantsToGroup.mockResolvedValue({
        ...mockConversation,
        participants: [
          { userId: mockUser.id, role: ParticipantRole.OWNER },
          { userId: 'user-789', role: ParticipantRole.MEMBER },
          { userId: 'user-101', role: ParticipantRole.MEMBER },
        ],
      });

      const result = await controller.addParticipantsToConversation(
        mockUser,
        mockConversationId,
        mockAddParticipantsDto,
      );

      expect(service.addParticipantsToGroup).toHaveBeenCalledWith(
        mockConversationId,
        mockAddParticipantsDto.participantIds,
        mockUser.id,
      );
      expect(result).toHaveProperty('participants');
      expect(result.participants.length).toBe(3);
    });

    it('should handle errors when adding participants to direct chat', async () => {
      mockConversationService.addParticipantsToGroup.mockRejectedValue(
        new ConflictException('Cannot add participants to direct chat'),
      );

      await expect(
        controller.addParticipantsToConversation(
          mockUser,
          'direct-123',
          mockAddParticipantsDto,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should handle errors when non-admin tries to add participants', async () => {
      mockConversationService.addParticipantsToGroup.mockRejectedValue(
        new ForbiddenException('Only admins can add participants'),
      );

      await expect(
        controller.addParticipantsToConversation(
          { id: 'non-admin-user', username: 'regular', tenantId: 'tenant-123' },
          mockConversationId,
          mockAddParticipantsDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateConversationSettings', () => {
    it('should update conversation settings', async () => {
      const updatedConversation = {
        ...mockConversation,
        settings: mockUpdateSettingsDto.settings,
      };
      mockConversationService.updateConversationSettings.mockResolvedValue(
        updatedConversation,
      );

      const result = await controller.updateConversationSettings(
        mockUser,
        mockConversationId,
        mockUpdateSettingsDto,
      );

      expect(service.updateConversationSettings).toHaveBeenCalledWith(
        mockConversationId,
        mockUpdateSettingsDto,
        mockUser.id,
      );
      expect(result).toEqual(updatedConversation);
    });

    it('should handle errors when conversation is not found', async () => {
      mockConversationService.updateConversationSettings.mockRejectedValue(
        new NotFoundException('Conversation not found'),
      );

      await expect(
        controller.updateConversationSettings(
          mockUser,
          'invalid-id',
          mockUpdateSettingsDto,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createMessage', () => {
    it('should create a new message in a conversation', async () => {
      mockConversationService.createMessage.mockResolvedValue(mockMessage);

      const result = await controller.createMessage(
        mockUser,
        mockConversationId,
        mockCreateMessageDto,
      );

      expect(service.createMessage).toHaveBeenCalledWith(
        mockConversationId,
        mockCreateMessageDto.content,
        mockUser.id,
      );
      expect(result).toEqual(mockMessage);
    });

    it('should handle errors when conversation is not found', async () => {
      mockConversationService.createMessage.mockRejectedValue(
        new NotFoundException('Conversation not found'),
      );

      await expect(
        controller.createMessage(mockUser, 'invalid-id', mockCreateMessageDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle errors when user lacks access to the conversation', async () => {
      mockConversationService.createMessage.mockRejectedValue(
        new ForbiddenException(
          'User does not have access to this conversation',
        ),
      );

      await expect(
        controller.createMessage(
          {
            id: 'unauthorized-user',
            username: 'hacker',
            tenantId: 'tenant-123',
          },
          mockConversationId,
          mockCreateMessageDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
