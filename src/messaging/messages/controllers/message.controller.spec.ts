import { Test, TestingModule } from '@nestjs/testing';
import { MessageController } from './message.controller';
import { MessageService } from '../services/message.service';
import { GetMessagesQueryDto } from '../dto/message-query.dto';
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
import { NotFoundException, ForbiddenException, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { MessageStatus, MessageType } from '../../shared/enums/message-type.enum';
import { ChatGuard } from '../../../guards/chat.guard';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthObject } from '@clerk/express';
import { MessageEntity } from '../entities/message.entity';
import { AttachmentEntity } from '../entities/attachment.entity';

// Helper type for mocked services
type DeepMocked<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? jest.Mock<ReturnType<T[K]>, Parameters<T[K]>> : DeepMocked<T[K]>;
} & T;


describe('MessageController', () => {
  let controller: MessageController;
  let messageServiceMock: DeepMocked<MessageService>;
  let chatGuardMock: DeepMocked<ChatGuard>;

  const mockAuthUser: AuthObject = {
    userId: 'user-clerk-123',
    orgId: 'org-clerk-456',
    sessionId: 'sess-clerk-789',
    actor: null,
    getToken: jest.fn().mockResolvedValue('mock-token'),
    has: jest.fn().mockReturnValue(true),
    debug: jest.fn(),
    claims: { },
  } as AuthObject;

  const mockConversationId = 'conv-123';
  const mockMessageId = 'msg-123';
  const mockTenantId = 'tenant-from-service-123'; // Assume service handles tenant context

  const createMockMessageResponse = (id: string, content: string, senderId: string): MessageResponseDto => ({
    id,
    conversationId: mockConversationId,
    content,
    senderId,
    parentMessageId: null,
    status: MessageStatus.SENT,
    type: MessageType.TEXT,
    reactions: [],
    readBy: {},
    isRead: false,
    isEdited: false,
    editHistory: [],
    metadata: { editHistory: [] },
    createdAt: new Date(),
    updatedAt: new Date(),
    attachments: [],
    replyCount: 0,
  });
  
  const mockMessageResponseInstance = createMockMessageResponse(mockMessageId, 'Test message', mockAuthUser.userId);

  const mockMessageWithRelationsInstance: MessageWithRelationsDto = {
    ...mockMessageResponseInstance,
    attachments: [],
    replyCount: 0,
  };
  
  const mockAttachmentResponse: AttachmentResponseDto = {
    id: 'attach-1',
    fileName: 'file.txt',
    fileSize: 100,
    mimeType: 'text/plain',
    url: 'http://example.com/file.txt',
    processingStatus: 'COMPLETED',
    createdAt: new Date(),
  };


  beforeEach(async () => {
    messageServiceMock = {
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
    } as DeepMocked<MessageService>;

    chatGuardMock = {
      canActivate: jest.fn().mockResolvedValue(true),
    } as DeepMocked<ChatGuard>;

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({ throttlers: [{ ttl: 60, limit: 10 }] }),
      ],
      controllers: [MessageController],
      providers: [
        { provide: MessageService, useValue: messageServiceMock },
      ],
    })
    .overrideGuard(ChatGuard).useValue(chatGuardMock)
    .overrideGuard(ThrottlerGuard).useValue({ canActivate: jest.fn().mockResolvedValue(true) })
    .compile();

    controller = module.get<MessageController>(MessageController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createMessage', () => {
    const dto: CreateMessageDto = { conversationId: mockConversationId, content: 'Hello', attachments: [], metadata: {}, parentMessageId: null };
    it('should create a message', async () => {
      messageServiceMock.createMessage.mockResolvedValue(mockMessageResponseInstance as MessageEntity);
      const result = await controller.createMessage(mockAuthUser, dto);
      expect(messageServiceMock.createMessage).toHaveBeenCalledWith(dto.conversationId, dto.content, mockAuthUser.userId, dto.attachments, dto.parentMessageId, dto.metadata);
      expect(result).toEqual(mockMessageResponseInstance);
    });
    it('should propagate error from service', async () => {
      const error = new BadRequestException('Invalid data');
      messageServiceMock.createMessage.mockRejectedValue(error);
      await expect(controller.createMessage(mockAuthUser, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMessages', () => {
    const query: GetMessagesQueryDto = { page: 1, limit: 10 };
    const messageListResponse: MessageListResponseDto = { messages: [mockMessageResponseInstance], total: 1, page: 1, limit: 10, unreadCount: 0 };
    it('should get messages for a conversation', async () => {
      messageServiceMock.getMessages.mockResolvedValue(messageListResponse);
      // Note: The controller's getMessages method takes @CurrentUser() but the service's getMessages might not if query DTO already has userId.
      // The current signature of `getMessages` in controller is `getMessages(@Param('conversationId') conversationId: string, @Query() query: GetMessagesQueryDto, @CurrentUser() user: AuthObject)`.
      // The service signature is `getMessages(conversationId: string, query: GetMessagesQueryDto)` where GetMessagesQueryDto can contain userId.
      // So, the controller should pass `user.userId` into `query.userId` if needed by the service.
      const queryWithUser = { ...query, userId: mockAuthUser.userId };
      const result = await controller.getMessages(mockConversationId, queryWithUser, mockAuthUser);
      expect(messageServiceMock.getMessages).toHaveBeenCalledWith(mockConversationId, queryWithUser);
      expect(result).toEqual(messageListResponse);
    });
     it('should propagate error from service', async () => {
      const error = new ForbiddenException('Access denied');
      const queryWithUser = { ...query, userId: mockAuthUser.userId };
      messageServiceMock.getMessages.mockRejectedValue(error);
      await expect(controller.getMessages(mockConversationId, queryWithUser, mockAuthUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMessageHistory', () => {
    // Assuming the controller route /history/:messageId means history of a specific message
    it('should get message history', async () => {
      const history = [{ content: 'old content', editedAt: new Date() }];
      messageServiceMock.getMessageHistory.mockResolvedValue(history);
      const result = await controller.getMessageHistory(mockAuthUser, mockMessageId);
      expect(messageServiceMock.getMessageHistory).toHaveBeenCalledWith(mockMessageId);
      expect(result).toEqual(history);
    });
    it('should propagate error from service', async () => {
      const error = new NotFoundException('History not found');
      messageServiceMock.getMessageHistory.mockRejectedValue(error);
      await expect(controller.getMessageHistory(mockAuthUser, mockMessageId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMessageById', () => {
    it('should get a message by ID', async () => {
      messageServiceMock.findMessageById.mockResolvedValue(mockMessageWithRelationsInstance as MessageEntity);
      const result = await controller.getMessageById(mockAuthUser, mockMessageId);
      // The controller findMessageById passes user.userId to service, but service findMessageById does not take it.
      // This is a mismatch. Assuming service findMessageById(messageId) is correct.
      expect(messageServiceMock.findMessageById).toHaveBeenCalledWith(mockMessageId);
      expect(result).toEqual(mockMessageWithRelationsInstance);
    });
     it('should propagate error from service', async () => {
      const error = new NotFoundException('Message not found');
      messageServiceMock.findMessageById.mockRejectedValue(error);
      await expect(controller.getMessageById(mockAuthUser, mockMessageId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMessage', () => {
    const dto: UpdateMessageDto = { content: 'Updated' };
    it('should update a message', async () => {
      messageServiceMock.updateMessage.mockResolvedValue(mockMessageResponseInstance as MessageEntity);
      const result = await controller.updateMessage(mockAuthUser, mockMessageId, dto);
      expect(messageServiceMock.updateMessage).toHaveBeenCalledWith(mockMessageId, dto, mockAuthUser.userId);
      expect(result).toEqual(mockMessageResponseInstance);
    });
    it('should propagate error from service', async () => {
      const error = new ForbiddenException('Not allowed');
      messageServiceMock.updateMessage.mockRejectedValue(error);
      await expect(controller.updateMessage(mockAuthUser, mockMessageId, dto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteMessage', () => {
    it('should delete a message', async () => {
      messageServiceMock.deleteMessage.mockResolvedValue(undefined);
      await controller.deleteMessage(mockAuthUser, mockMessageId);
      expect(messageServiceMock.deleteMessage).toHaveBeenCalledWith(mockMessageId, mockAuthUser.userId);
    });
    it('should propagate error from service', async () => {
      const error = new NotFoundException('Cannot delete');
      messageServiceMock.deleteMessage.mockRejectedValue(error);
      await expect(controller.deleteMessage(mockAuthUser, mockMessageId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addReaction', () => {
    const dto: ReactionDto = { emoji: '👍' };
    it('should add a reaction', async () => {
      messageServiceMock.addReaction.mockResolvedValue(mockMessageResponseInstance as MessageEntity);
      const result = await controller.addReaction(mockAuthUser, mockMessageId, dto);
      expect(messageServiceMock.addReaction).toHaveBeenCalledWith(mockMessageId, mockAuthUser.userId, dto.emoji);
      expect(result).toEqual(mockMessageResponseInstance);
    });
    it('should propagate error from service', async () => {
      const error = new BadRequestException('Cannot react');
      messageServiceMock.addReaction.mockRejectedValue(error);
      await expect(controller.addReaction(mockAuthUser, mockMessageId, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeReaction', () => {
    const dto: ReactionDto = { emoji: '👍' };
    it('should remove a reaction', async () => {
      messageServiceMock.removeReaction.mockResolvedValue(mockMessageResponseInstance as MessageEntity);
      const result = await controller.removeReaction(mockAuthUser, mockMessageId, dto);
      expect(messageServiceMock.removeReaction).toHaveBeenCalledWith(mockMessageId, mockAuthUser.userId, dto.emoji);
      expect(result).toEqual(mockMessageResponseInstance);
    });
     it('should propagate error from service', async () => {
      const error = new NotFoundException('Cannot remove reaction');
      messageServiceMock.removeReaction.mockRejectedValue(error);
      await expect(controller.removeReaction(mockAuthUser, mockMessageId, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAttachmentsByMessageId', () => {
    it('should get attachments for a message', async () => {
      const attachments = [mockAttachmentResponse];
      messageServiceMock.getAttachments.mockResolvedValue(attachments as AttachmentEntity[]);
      const result = await controller.getAttachmentsByMessageId(mockMessageId);
      expect(messageServiceMock.getAttachments).toHaveBeenCalledWith(mockMessageId);
      expect(result).toEqual(attachments);
    });
    it('should propagate error from service', async () => {
      const error = new NotFoundException('No attachments');
      messageServiceMock.getAttachments.mockRejectedValue(error);
      await expect(controller.getAttachmentsByMessageId(mockMessageId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getThreadReplies', () => {
    const query: GetMessagesQueryDto = { page: 1, limit: 5 };
    it('should get thread replies', async () => {
      const replies = [mockMessageResponseInstance];
      messageServiceMock.getThreadReplies.mockResolvedValue(replies as MessageEntity[]);
      // Controller's getThreadReplies takes GetMessagesQueryDto, service takes PaginationOptions
      // This assumes they are compatible or mapping happens.
      const result = await controller.getThreadReplies(mockMessageId, query);
      expect(messageServiceMock.getThreadReplies).toHaveBeenCalledWith(mockMessageId, query);
      expect(result).toEqual(replies);
    });
     it('should propagate error from service', async () => {
      const error = new NotFoundException('No parent message');
      messageServiceMock.getThreadReplies.mockRejectedValue(error);
      await expect(controller.getThreadReplies(mockMessageId, query)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsRead', () => {
    it('should mark a message as read', async () => {
      messageServiceMock.markMessageAsRead.mockResolvedValue(undefined);
      await controller.markAsRead(mockAuthUser, mockMessageId);
      expect(messageServiceMock.markMessageAsRead).toHaveBeenCalledWith(mockMessageId, mockAuthUser.userId);
    });
    it('should propagate error from service', async () => {
      const error = new NotFoundException('Message not found to mark as read');
      messageServiceMock.markMessageAsRead.mockRejectedValue(error);
      await expect(controller.markAsRead(mockAuthUser, mockMessageId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUnreadMessagesCount', () => {
    it('should get unread messages count', async () => {
      const count = 5;
      messageServiceMock.getUnreadCount.mockResolvedValue(count);
      const result = await controller.getUnreadMessagesCount(mockAuthUser, mockConversationId);
      expect(messageServiceMock.getUnreadCount).toHaveBeenCalledWith(mockConversationId, mockAuthUser.userId);
      expect(result).toBe(count);
    });
    it('should propagate error from service', async () => {
      const error = new ForbiddenException('Access denied to count');
      messageServiceMock.getUnreadCount.mockRejectedValue(error);
      await expect(controller.getUnreadMessagesCount(mockAuthUser, mockConversationId)).rejects.toThrow(ForbiddenException);
    });
  });
});
