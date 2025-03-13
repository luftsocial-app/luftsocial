import { Test, TestingModule } from '@nestjs/testing';
import { MessageController } from './message.controller';
import { MessageService } from '../services/message.service';
import { MessageQueryDto } from '../../conversations/dto/conversation.dto';
import {
  CreateMessageDto,
  ReactionDto,
  UpdateMessageDto,
} from '../dto/message.dto';
import {
  AttachmentResponseDto,
  MessageListResponseDto,
  MessageResponseDto,
  MessageWithRelationsDto,
} from '../dto/message-response.dto';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { MessageStatus } from '../../shared/enums/message-type.enum';
import { ChatGuard } from '../../../guards/chat.guard';
import { ConversationService } from '../../conversations/services/conversation.service';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

describe('MessageController', () => {
  let controller: MessageController;
  let service: MessageService;

  // Mock test data
  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    tenantId: 'tenant-123',
  };

  const mockConversationId = 'conv-123';
  const mockMessageId = 'msg-123';

  const mockMessageResponse: MessageResponseDto = {
    id: mockMessageId,
    conversationId: mockConversationId,
    content: 'Test message content',
    senderId: mockUser.id,
    parentMessageId: null,
    status: MessageStatus.SENT,
    reactions: [],
    readBy: [],
    isRead: false,
    isEdited: false,
    editHistory: [],
    metadata: { editHistory: [] },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMessageWithRelations: MessageWithRelationsDto = {
    ...mockMessageResponse,
    attachments: [],
    replyCount: 0,
  };

  const mockThreadReply: MessageResponseDto = {
    id: 'reply-123',
    conversationId: mockConversationId,
    content: 'This is a reply',
    senderId: mockUser.id,
    parentMessageId: mockMessageId,
    status: MessageStatus.SENT,
    reactions: [],
    readBy: [],
    isRead: false,
    isEdited: false,
    editHistory: [],
    metadata: { editHistory: [] },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAttachment: AttachmentResponseDto = {
    id: 'attachment-123',
    fileName: 'test.jpg',
    fileSize: 1024,
    mimeType: 'image/jpeg',
    url: 'https://example.com/test.jpg',
    processingStatus: 'COMPLETED',
    createdAt: new Date(),
  };

  const mockMessageList: MessageListResponseDto = {
    messages: [mockMessageResponse],
    total: 1,
    page: 1,
    pageSize: 20,
    unreadCount: 0,
  };

  const mockCreateMessageDto: CreateMessageDto = {
    conversationId: mockConversationId,
    content: 'Test message content',
    parentMessageId: null,
  };

  const mockUpdateMessageDto: UpdateMessageDto = {
    content: 'Updated message content',
  };

  const mockReactionDto: ReactionDto = {
    emoji: '👍',
  };

  const mockMessageQuery: MessageQueryDto = {
    conversationId: mockConversationId,
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    includeDeleted: false,
  };

  // Define service mock
  const mockMessageService = {
    getMessages: jest.fn(),
    createMessage: jest.fn(),
    getMessageHistory: jest.fn(),
    findMessageById: jest.fn(),
    updateMessage: jest.fn(),
    deleteMessage: jest.fn(),
    addReaction: jest.fn(),
    removeReaction: jest.fn(),
    getAttachments: jest.fn(),
    getThreadReplies: jest.fn(),
    markMessageAsRead: jest.fn(),
    getUnreadCount: jest.fn(),
  };

  // Mock ConversationService
  const mockConversationService = {
    validateAccess: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    // Set up the testing module
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [
            {
              ttl: 60,
              limit: 10,
            },
          ],
        }),
      ],
      controllers: [MessageController],
      providers: [
        {
          provide: MessageService,
          useValue: mockMessageService,
        },
        {
          provide: ConversationService,
          useValue: mockConversationService,
        },
        {
          provide: ChatGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        {
          provide: ThrottlerGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
      ],
    }).compile();

    controller = module.get<MessageController>(MessageController);
    service = module.get<MessageService>(MessageService);

    // Reset mock implementation before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('getMessages', () => {
    it('should return messages from a conversation', async () => {
      mockMessageService.getMessages.mockResolvedValue(mockMessageList);

      const result = await controller.getMessages(
        mockUser,
        mockConversationId,
        mockMessageQuery,
      );

      expect(service.getMessages).toHaveBeenCalledWith(
        mockConversationId,
        mockMessageQuery,
      );
      expect(result).toEqual(mockMessageList);
    });

    it('should handle errors when retrieving messages', async () => {
      mockMessageService.getMessages.mockRejectedValue(
        new ForbiddenException('Access denied'),
      );

      await expect(
        controller.getMessages(mockUser, mockConversationId, mockMessageQuery),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createMessage', () => {
    it('should create a new message', async () => {
      mockMessageService.createMessage.mockResolvedValue(mockMessageResponse);

      const result = await controller.createMessage(
        mockUser,
        mockCreateMessageDto,
      );

      expect(service.createMessage).toHaveBeenCalledWith(
        mockCreateMessageDto.conversationId,
        mockCreateMessageDto.content,
        mockUser.id,
        mockCreateMessageDto.parentMessageId,
      );
      expect(result).toEqual(mockMessageResponse);
    });

    it('should handle errors when creating a message', async () => {
      mockMessageService.createMessage.mockRejectedValue(
        new ForbiddenException('No access to this conversation'),
      );

      await expect(
        controller.createMessage(mockUser, mockCreateMessageDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMessageHistory', () => {
    it('should return message history for a user', async () => {
      mockMessageService.getMessageHistory.mockResolvedValue([
        mockMessageResponse,
      ]);

      const result = await controller.getMessageHistory(mockUser, mockUser.id);

      expect(service.getMessageHistory).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual([mockMessageResponse]);
    });

    it('should handle errors when retrieving message history', async () => {
      mockMessageService.getMessageHistory.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        controller.getMessageHistory(mockUser, 'invalid-user'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMessage', () => {
    it('should return a message by ID', async () => {
      mockMessageService.findMessageById.mockResolvedValue(
        mockMessageWithRelations,
      );

      const result = await controller.getMessage(mockUser, mockMessageId);

      expect(service.findMessageById).toHaveBeenCalledWith(
        mockMessageId,
        mockUser.id,
      );
      expect(result).toEqual(mockMessageWithRelations);
    });

    it('should handle errors when message is not found', async () => {
      mockMessageService.findMessageById.mockRejectedValue(
        new NotFoundException('Message not found'),
      );

      await expect(
        controller.getMessage(mockUser, 'invalid-message'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMessage', () => {
    it('should update a message', async () => {
      const updatedMessage = {
        ...mockMessageResponse,
        content: mockUpdateMessageDto.content,
        isEdited: true,
      };
      mockMessageService.updateMessage.mockResolvedValue(updatedMessage);

      const result = await controller.updateMessage(
        mockUser,
        mockMessageId,
        mockUpdateMessageDto,
      );

      expect(service.updateMessage).toHaveBeenCalledWith(
        mockMessageId,
        mockUpdateMessageDto,
        mockUser.id,
      );
      expect(result).toEqual(updatedMessage);
    });

    it('should handle errors when updating a message that does not exist', async () => {
      mockMessageService.updateMessage.mockRejectedValue(
        new NotFoundException('Message not found'),
      );

      await expect(
        controller.updateMessage(
          mockUser,
          'invalid-message',
          mockUpdateMessageDto,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle errors when user is not authorized to update the message', async () => {
      mockMessageService.updateMessage.mockRejectedValue(
        new ForbiddenException('You can only edit your own messages'),
      );

      await expect(
        controller.updateMessage(
          { ...mockUser, id: 'different-user' },
          mockMessageId,
          mockUpdateMessageDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteMessage', () => {
    it('should delete a message', async () => {
      mockMessageService.deleteMessage.mockResolvedValue(undefined);

      await controller.deleteMessage(mockUser, mockMessageId);

      expect(service.deleteMessage).toHaveBeenCalledWith(
        mockMessageId,
        mockUser.id,
      );
    });

    it('should handle errors when deleting a message that does not exist', async () => {
      mockMessageService.deleteMessage.mockRejectedValue(
        new NotFoundException('Message not found'),
      );

      await expect(
        controller.deleteMessage(mockUser, 'invalid-message'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle errors when user is not authorized to delete the message', async () => {
      mockMessageService.deleteMessage.mockRejectedValue(
        new ForbiddenException('You can only delete your own messages'),
      );

      await expect(
        controller.deleteMessage(
          { ...mockUser, id: 'different-user' },
          mockMessageId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addReaction', () => {
    it('should add a reaction to a message', async () => {
      const messageWithReaction = {
        ...mockMessageResponse,
        reactions: [{ userId: mockUser.id, emoji: mockReactionDto.emoji }],
      };
      mockMessageService.addReaction.mockResolvedValue(messageWithReaction);

      const result = await controller.addReaction(
        mockUser,
        mockMessageId,
        mockReactionDto,
      );

      expect(service.addReaction).toHaveBeenCalledWith(
        mockMessageId,
        mockUser.id,
        mockReactionDto.emoji,
      );
      expect(result).toEqual(messageWithReaction);
    });

    it('should handle errors when adding a reaction to a non-existent message', async () => {
      mockMessageService.addReaction.mockRejectedValue(
        new NotFoundException('Message not found'),
      );

      await expect(
        controller.addReaction(mockUser, 'invalid-message', mockReactionDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeReaction', () => {
    it('should remove a reaction from a message', async () => {
      mockMessageService.removeReaction.mockResolvedValue(mockMessageResponse);

      const result = await controller.removeReaction(
        mockUser,
        mockMessageId,
        mockReactionDto,
      );

      expect(service.removeReaction).toHaveBeenCalledWith(
        mockMessageId,
        mockUser.id,
        mockReactionDto.emoji,
      );
      expect(result).toEqual(mockMessageResponse);
    });

    it('should handle errors when removing a reaction from a non-existent message', async () => {
      mockMessageService.removeReaction.mockRejectedValue(
        new NotFoundException('Message not found'),
      );

      await expect(
        controller.removeReaction(mockUser, 'invalid-message', mockReactionDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAttachments', () => {
    it('should return attachments for a message', async () => {
      mockMessageService.getAttachments.mockResolvedValue([mockAttachment]);

      const result = await controller.getAttachments(mockMessageId);

      expect(service.getAttachments).toHaveBeenCalledWith(mockMessageId);
      expect(result).toEqual([mockAttachment]);
    });

    it('should handle errors when message is not found', async () => {
      mockMessageService.getAttachments.mockRejectedValue(
        new NotFoundException('Message not found'),
      );

      await expect(
        controller.getAttachments('invalid-message'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getThreadReplies', () => {
    it('should return thread replies for a parent message', async () => {
      mockMessageService.getThreadReplies.mockResolvedValue([mockThreadReply]);

      const result = await controller.getThreadReplies(mockMessageId);

      expect(service.getThreadReplies).toHaveBeenCalledWith(mockMessageId);
      expect(result).toEqual([mockThreadReply]);
    });

    it('should handle errors when parent message is not found', async () => {
      mockMessageService.getThreadReplies.mockRejectedValue(
        new NotFoundException('Parent message not found'),
      );

      await expect(
        controller.getThreadReplies('invalid-message'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsRead', () => {
    it('should mark a message as read', async () => {
      mockMessageService.markMessageAsRead.mockResolvedValue(undefined);

      await controller.markAsRead(mockUser, mockMessageId);

      expect(service.markMessageAsRead).toHaveBeenCalledWith(
        mockMessageId,
        mockUser.id,
      );
    });

    it('should handle errors when message is not found', async () => {
      mockMessageService.markMessageAsRead.mockRejectedValue(
        new NotFoundException('Message not found'),
      );

      await expect(
        controller.markAsRead(mockUser, 'invalid-message'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread message count for a conversation', async () => {
      mockMessageService.getUnreadCount.mockResolvedValue(5);

      const result = await controller.getUnreadCount(
        mockUser,
        mockConversationId,
      );

      expect(service.getUnreadCount).toHaveBeenCalledWith(
        mockConversationId,
        mockUser.id,
      );
      expect(result).toBe(5);
    });

    it('should handle errors when retrieving unread count', async () => {
      mockMessageService.getUnreadCount.mockRejectedValue(
        new NotFoundException('Conversation not found'),
      );

      await expect(
        controller.getUnreadCount(mockUser, 'invalid-conversation'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle forbidden access to conversation', async () => {
      mockMessageService.getUnreadCount.mockRejectedValue(
        new ForbiddenException('Access denied to conversation'),
      );

      await expect(
        controller.getUnreadCount(mockUser, mockConversationId),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
