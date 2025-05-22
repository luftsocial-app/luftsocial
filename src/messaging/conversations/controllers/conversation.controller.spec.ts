import { Test, TestingModule } from '@nestjs/testing';
import { ConversationController } from './conversation.controller';
import { ConversationService } from '../services/conversation.service';
import { ConversationEntity } from '../entities/conversation.entity';
import {
  CreateConversationDto,
  AddParticipantsDto,
  UpdateConversationSettingsDto,
  RemoveParticipantsDto,
  UpdateLastActiveTimestampDto,
} from '../dto/conversation.dto';
import { ConversationType } from '../../shared/enums/conversation-type.enum';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ParticipantRole } from '../../shared/enums/participant-role.enum';
import { AuthObject } from '@clerk/express';
// TenantService mock is not needed here as controller doesn't directly use it.
import { ChatGuard } from '../../../guards/chat.guard'; // Import ChatGuard
import { User as ClerkUser } from '@clerk/backend'; // For mocking service return types if needed

// jest.mock('../../../user-management/tenant.service', () => ({ // No longer needed
//   TenantService: jest.fn().mockImplementation(() => ({
//     getTenantId: jest.fn(),
//     setTenantId: jest.fn(),
//   })),
// }));

// Helper type for mocked services
type DeepMocked<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? jest.Mock<ReturnType<T[K]>, Parameters<T[K]>>
    : DeepMocked<T[K]>;
} & T;

describe('ConversationController', () => {
  let controller: ConversationController;
  let conversationServiceMock: DeepMocked<ConversationService>;
  let chatGuardMock: DeepMocked<ChatGuard>;

  // Mock test data
  const mockAuthUser: AuthObject = {
    userId: 'user-123',
    orgId: 'org-456',
    sessionId: 'sess-789',
    actor: null,
    getToken: jest.fn().mockResolvedValue('mock-token'),
    has: jest.fn().mockReturnValue(true),
    debug: jest.fn(),
    claims: { org_role: 'org:admin' }, // Example, adjust as needed
  } as AuthObject;

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
      // Note: The DTO in service.spec.ts has muteNotifications, enableReadReceipts
      // but ParticipantEntity settings has muted, pinned, notificationsEnabled.
      // This might be a discrepancy to align. Assuming DTO matches service expectation.
      muteNotifications: true,
      enableReadReceipts: false,
    },
  };

  const mockRemoveParticipantsDto: RemoveParticipantsDto = {
    participantIds: ['user-to-remove-1', 'user-to-remove-2'],
  };

  const mockUpdateLastActiveDto: UpdateLastActiveTimestampDto = {
    lastActiveAt: new Date(),
  };

  beforeEach(async () => {
    conversationServiceMock = {
      createOrGetDirectChat: jest.fn(),
      createGroupChat: jest.fn(),
      getConversationsByUserId: jest.fn(), // Renamed from getConversations in controller
      getConversation: jest.fn(),
      addParticipantsToGroup: jest.fn(),
      updateConversationSettings: jest.fn(),
      removeParticipantsFromGroup: jest.fn(),
      updateParticipantLastActive: jest.fn(),
      // createMessage: jest.fn(), // This method is not in the controller in the provided code
      // leaveConversation: jest.fn(), // This method is not in the controller in the provided code
    } as DeepMocked<ConversationService>;

    chatGuardMock = {
      canActivate: jest.fn().mockResolvedValue(true), // Default to allow access
    } as DeepMocked<ChatGuard>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        { provide: ConversationService, useValue: conversationServiceMock },
      ],
    })
      .overrideGuard(ChatGuard) // Override the ChatGuard for all routes in this controller
      .useValue(chatGuardMock)
      .compile();

    controller = module.get<ConversationController>(ConversationController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('General Guard Behavior', () => {
    it('should deny access if ChatGuard.canActivate returns false', async () => {
      chatGuardMock.canActivate.mockResolvedValue(false); // Guard denies access
      // Test with any method, e.g., getMyConversations
      await expect(controller.getMyConversations(mockAuthUser)).rejects.toThrow(
        ForbiddenException,
      );
      // Or whatever exception the guard is configured to throw. Assuming ForbiddenException for typical guards.
      // If ChatGuard itself throws, that specific error would be expected.
      // For this test, we check if canActivate was called.
      expect(chatGuardMock.canActivate).toHaveBeenCalled();
    });
  });

  describe('createOrGetDirectChat', () => {
    it('should create or get a direct chat with another user', async () => {
      conversationServiceMock.createOrGetDirectChat.mockResolvedValue(
        mockDirectConversation as ConversationEntity,
      );

      const result = await controller.createOrGetDirectChat(
        mockAuthUser,
        mockOtherUserId,
      );

      expect(
        conversationServiceMock.createOrGetDirectChat,
      ).toHaveBeenCalledWith(mockAuthUser.userId, mockOtherUserId);
      expect(result).toEqual(mockDirectConversation);
    });

    it('should handle errors when creating direct chat', async () => {
      const error = new NotFoundException('User not found');
      conversationServiceMock.createOrGetDirectChat.mockRejectedValue(error);

      await expect(
        controller.createOrGetDirectChat(mockAuthUser, 'invalid-user'),
      ).rejects.toThrow(error);
    });
  });

  describe('createGroupChat', () => {
    it('should create a new group chat', async () => {
      conversationServiceMock.createGroupChat.mockResolvedValue(
        mockConversation as ConversationEntity,
      );

      const result = await controller.createGroupChat(
        mockAuthUser,
        mockCreateGroupDto,
      );

      expect(conversationServiceMock.createGroupChat).toHaveBeenCalledWith(
        mockCreateGroupDto.name,
        mockCreateGroupDto.participantIds,
        mockAuthUser.userId, // creatorId
      );
      expect(result).toEqual(mockConversation);
    });

    it('should handle errors when creating group chat', async () => {
      const error = new NotFoundException('One or more users not found');
      conversationServiceMock.createGroupChat.mockRejectedValue(error);

      await expect(
        controller.createGroupChat(mockAuthUser, {
          ...mockCreateGroupDto,
          participantIds: ['invalid-id'],
        }),
      ).rejects.toThrow(error);
    });
  });

  describe('getMyConversations', () => {
    it('should return all conversations for the current user', async () => {
      const mockConversationsArray = [mockConversation, mockDirectConversation];
      conversationServiceMock.getConversationsByUserId.mockResolvedValue(
        mockConversationsArray as ConversationEntity[],
      );

      const result = await controller.getMyConversations(mockAuthUser);

      expect(
        conversationServiceMock.getConversationsByUserId,
      ).toHaveBeenCalledWith(mockAuthUser.userId);
      expect(result).toEqual(mockConversationsArray);
    });
  });

  describe('getConversationById', () => {
    // Renamed to match controller method name
    it('should return a specific conversation by ID', async () => {
      conversationServiceMock.getConversation.mockResolvedValue(
        mockConversation as ConversationEntity,
      );

      // Note: The controller method is getConversationById, but the route param is :conversationId
      // The method name in the test description was getConversation, matching the service.
      // The controller method is actually getConversationById.
      const result = await controller.getConversationById(mockConversationId);

      expect(conversationServiceMock.getConversation).toHaveBeenCalledWith(
        mockConversationId,
      );
      expect(result).toEqual(mockConversation);
    });

    it('should handle errors when conversation is not found', async () => {
      const error = new NotFoundException('Conversation not found');
      conversationServiceMock.getConversation.mockRejectedValue(error);

      await expect(
        controller.getConversationById('invalid-id'),
      ).rejects.toThrow(error);
    });
  });

  describe('addParticipantsToGroup', () => {
    // Renamed from addParticipantsToConversation
    it('should add participants to a conversation', async () => {
      const updatedConv = {
        ...mockConversation,
        participants: [
          { userId: mockAuthUser.userId, role: ParticipantRole.OWNER } as any,
          { userId: 'user-789', role: ParticipantRole.MEMBER } as any,
          { userId: 'user-101', role: ParticipantRole.MEMBER } as any,
        ],
      } as ConversationEntity;
      conversationServiceMock.addParticipantsToGroup.mockResolvedValue(
        updatedConv,
      );

      const result = await controller.addParticipantsToGroup(
        // Method name in controller
        mockAuthUser,
        mockConversationId,
        mockAddParticipantsDto,
      );

      expect(
        conversationServiceMock.addParticipantsToGroup,
      ).toHaveBeenCalledWith(
        mockConversationId,
        mockAddParticipantsDto.participantIds,
        mockAuthUser.userId,
      );
      expect(result).toEqual(updatedConv);
    });

    it('should handle ConflictException from service', async () => {
      const error = new ConflictException(
        'Cannot add participants to direct chat',
      );
      conversationServiceMock.addParticipantsToGroup.mockRejectedValue(error);

      await expect(
        controller.addParticipantsToGroup(
          mockAuthUser,
          'direct-123', // Assuming this ID implies a direct chat
          mockAddParticipantsDto,
        ),
      ).rejects.toThrow(error);
    });

    it('should handle ForbiddenException from service', async () => {
      const error = new ForbiddenException('Only admins can add participants');
      conversationServiceMock.addParticipantsToGroup.mockRejectedValue(error);

      const nonAdminUser = { ...mockAuthUser, userId: 'non-admin-user' };
      await expect(
        controller.addParticipantsToGroup(
          nonAdminUser,
          mockConversationId,
          mockAddParticipantsDto,
        ),
      ).rejects.toThrow(error);
    });
  });

  describe('updateConversationSettings', () => {
    it('should update conversation settings', async () => {
      const updatedConversation = {
        ...mockConversation,
        settings: mockUpdateSettingsDto.settings, // This assumes settings is a direct field.
        // If it's a JSONB field named 'settings', the DTO structure matters.
        // Based on DTO, it looks like settings IS a sub-object.
      } as ConversationEntity;
      conversationServiceMock.updateConversationSettings.mockResolvedValue(
        updatedConversation,
      );

      const result = await controller.updateConversationSettings(
        mockAuthUser,
        mockConversationId,
        mockUpdateSettingsDto,
      );

      expect(
        conversationServiceMock.updateConversationSettings,
      ).toHaveBeenCalledWith(
        mockConversationId,
        mockUpdateSettingsDto,
        mockAuthUser.userId,
      );
      expect(result).toEqual(updatedConversation);
    });

    it('should handle NotFoundException from service', async () => {
      const error = new NotFoundException('Conversation not found');
      conversationServiceMock.updateConversationSettings.mockRejectedValue(
        error,
      );

      await expect(
        controller.updateConversationSettings(
          mockAuthUser,
          'invalid-id',
          mockUpdateSettingsDto,
        ),
      ).rejects.toThrow(error);
    });
  });

  describe('removeParticipantsFromGroup', () => {
    it('should remove participants from a group', async () => {
      const updatedConv = {
        ...mockConversation,
        participants: [],
      } as ConversationEntity;
      conversationServiceMock.removeParticipantsFromGroup.mockResolvedValue(
        updatedConv,
      );

      const result = await controller.removeParticipantsFromGroup(
        mockAuthUser,
        mockConversationId,
        mockRemoveParticipantsDto,
      );
      expect(
        conversationServiceMock.removeParticipantsFromGroup,
      ).toHaveBeenCalledWith(
        mockConversationId,
        mockRemoveParticipantsDto.participantIds,
        mockAuthUser.userId,
      );
      expect(result).toEqual(updatedConv);
    });

    it('should handle ForbiddenException from service', async () => {
      const error = new ForbiddenException('Cannot remove owner');
      conversationServiceMock.removeParticipantsFromGroup.mockRejectedValue(
        error,
      );
      await expect(
        controller.removeParticipantsFromGroup(
          mockAuthUser,
          mockConversationId,
          mockRemoveParticipantsDto,
        ),
      ).rejects.toThrow(error);
    });
  });

  describe('updateLastActiveTimestamp', () => {
    it('should call service to update last active timestamp', async () => {
      conversationServiceMock.updateParticipantLastActive.mockResolvedValue(
        undefined,
      ); // void method

      await controller.updateLastActiveTimestamp(
        mockAuthUser,
        mockConversationId,
        mockUpdateLastActiveDto,
      );

      expect(
        conversationServiceMock.updateParticipantLastActive,
      ).toHaveBeenCalledWith(
        mockAuthUser.userId,
        mockConversationId,
        // The service method `updateParticipantLastActive` in the provided code does not take a DTO or lastActiveAt date.
        // It seems to internally set the timestamp.
        // If the controller is meant to pass a date, the service method needs an update.
        // Assuming the controller's DTO is for future use or a slight mismatch.
        // For now, the service method `updateParticipantLastActive` doesn't use the DTO's date.
        // If the service was: updateParticipantLastActive(userId, convId, date), then: mockUpdateLastActiveDto.lastActiveAt
      );
      // No specific return to assert for void method, just that it doesn't throw an unexpected error.
      expect(true).toBe(true);
    });

    it('should handle errors from service', async () => {
      const error = new HttpException(
        'Service error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      conversationServiceMock.updateParticipantLastActive.mockRejectedValue(
        error,
      );
      await expect(
        controller.updateLastActiveTimestamp(
          mockAuthUser,
          mockConversationId,
          mockUpdateLastActiveDto,
        ),
      ).rejects.toThrow(error);
    });
  });

  // The `leaveConversation` method is not defined in the provided controller code (`conversation.controller.ts`)
  // If it were, tests would be similar to:
  // describe('leaveConversation', () => {
  //   it('should allow a user to leave a conversation', async () => {
  //     conversationServiceMock.leaveConversation.mockResolvedValue(undefined); // Assuming void or some status
  //     await controller.leaveConversation(mockAuthUser, mockConversationId);
  //     expect(conversationServiceMock.leaveConversation).toHaveBeenCalledWith(mockConversationId, mockAuthUser.userId);
  //   });
  // });
});
