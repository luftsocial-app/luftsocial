import { Test, TestingModule } from '@nestjs/testing';
import { MessageService } from './message.service';
import { MessageRepository } from '../repositories/message.repository';
import { AttachmentRepository } from '../repositories/attachment.repository';
import { ConversationService } from '../../conversations/services/conversation.service';
import { TenantService } from '../../../database/tenant.service';
import {
  MessageStatus,
  MessageType,
} from '../../shared/enums/message-type.enum';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { MessageEntity } from '../entities/message.entity';
import { AttachmentEntity } from '../entities/attachment.entity';

describe('MessageService', () => {
  let service: MessageService;
  let messageRepository: jest.Mocked<MessageRepository>;
  let attachmentRepository: jest.Mocked<AttachmentRepository>;
  let conversationService: jest.Mocked<ConversationService>;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let tenantService: jest.Mocked<TenantService>;

  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-123';
  const mockConversationId = 'conv-123';
  const mockMessageId = 'msg-123';

  const mockMessage: MessageEntity = Object.assign(new MessageEntity(), {
    id: mockMessageId,
    conversationId: mockConversationId,
    content: 'Test message',
    senderId: mockUserId,
    tenantId: mockTenantId,
    status: MessageStatus.SENT,
    type: MessageType.TEXT,
    readBy: {},
    reactions: [],
    editHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    parentMessageId: null,
    metadata: {
      reactions: {},
      editHistory: [],
    },
    conversation: null,
    sender: null,
    attachments: [],
    isEdited: false,
    isDeleted: false,
    isPinned: false,
    deletedBy: null,
    addEditHistory(content: string) {
      if (!this.metadata.editHistory) {
        this.metadata.editHistory = [];
      }
      this.metadata.editHistory.push({
        content,
        editedAt: new Date(),
      });
      this.isEdited = true;
    },
    addReaction(userId: string, emoji: string) {
      if (!this.metadata.reactions) {
        this.metadata.reactions = {};
      }
      this.metadata.reactions[userId] = emoji;
    },
    removeReaction(userId: string, emoji?: string) {
      if (!this.reactions) return;

      if (emoji) {
        this.reactions = this.reactions.filter(
          (r) => !(r.userId === userId && r.emoji === emoji),
        );
      } else {
        this.reactions = this.reactions.filter((r) => r.userId !== userId);
      }
    },
    markAsRead: function (userId: string) {
      this.readBy[userId] = new Date();
    },
    isReadBy: function (userId: string): boolean {
      return !!this.readBy[userId];
    },
    getReadCount: function (): number {
      return Object.keys(this.readBy).length;
    },
    getReactionCount: function (): number {
      return this.reactions.length;
    },
  });

  const mockAttachment: Partial<AttachmentEntity> = {
    id: 'attachment-123',
    messageId: mockMessageId,
    fileName: 'test.txt',
    fileSize: 1024,
    mimeType: 'text/plain',
    url: 'http://example.com/test.txt',
    processingStatus: 'completed',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        {
          provide: MessageRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findByIdAndTenant: jest.fn(),
            findByConversation: jest.fn(),
            findMessageHistory: jest.fn(),
            findThreadReplies: jest.fn(),
            update: jest.fn(),
            markAsDeleted: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: AttachmentRepository,
          useValue: {
            findByMessageId: jest.fn(),
          },
        },
        {
          provide: ConversationService,
          useValue: {
            validateAccess: jest.fn(),
            updateLastMessageTimestamp: jest.fn(),
          },
        },
        {
          provide: TenantService,
          useValue: {
            getTenantId: jest.fn().mockReturnValue(mockTenantId),
          },
        },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
    messageRepository = module.get(MessageRepository);
    attachmentRepository = module.get(AttachmentRepository);
    conversationService = module.get(ConversationService);
    tenantService = module.get(TenantService);
  });

  describe('createMessage', () => {
    it('should create a message successfully', async () => {
      conversationService.validateAccess.mockResolvedValue(true);
      messageRepository.create.mockImplementation((entity) =>
        Object.assign(new MessageEntity(), mockMessage, entity),
      );
      messageRepository.save.mockResolvedValue(mockMessage);

      const result = await service.createMessage(
        mockConversationId,
        'Test message',
        mockUserId,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(mockMessageId);
      expect(result.content).toBe('Test message');
      expect(
        conversationService.updateLastMessageTimestamp,
      ).toHaveBeenCalledWith(mockConversationId);
    });

    it('should throw ForbiddenException when user has no access', async () => {
      conversationService.validateAccess.mockResolvedValue(false);

      await expect(
        service.createMessage(mockConversationId, 'Test message', mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateMessage', () => {
    it('should update message successfully', async () => {
      const updatedMessage = {
        ...mockMessage,
        content: 'Updated content',
        isEdited: true,
        metadata: {
          ...mockMessage.metadata,
          editHistory: [
            {
              content: 'Test message',
              editedAt: expect.any(Date),
            },
          ],
        },
      };
      messageRepository.findByIdAndTenant.mockResolvedValue(mockMessage);
      messageRepository.save.mockResolvedValue(
        Object.assign(new MessageEntity(), updatedMessage),
      );

      const result = await service.updateMessage(
        mockMessageId,
        { content: 'Updated content' },
        mockUserId,
      );

      expect(result).toBeDefined();
      expect(result.content).toBe('Updated content');
      expect(result.isEdited).toBe(true);
    });

    it('should throw ForbiddenException when user is not message sender', async () => {
      messageRepository.findByIdAndTenant.mockResolvedValue(
        Object.assign(new MessageEntity(), {
          ...mockMessage,
          senderId: 'different-user',
        }),
      );

      await expect(
        service.updateMessage(
          mockMessageId,
          { content: 'Updated content' },
          mockUserId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteMessage', () => {
    it('should delete message successfully', async () => {
      messageRepository.findByIdAndTenant.mockResolvedValue(mockMessage);

      await service.deleteMessage(mockMessageId, mockUserId);

      expect(messageRepository.markAsDeleted).toHaveBeenCalledWith(
        mockMessageId,
        mockUserId,
      );
    });

    it('should throw NotFoundException when message not found', async () => {
      messageRepository.findByIdAndTenant.mockResolvedValue(null);

      await expect(
        service.deleteMessage(mockMessageId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMessages', () => {
    it('should return messages with pagination', async () => {
      const mockMessages = [mockMessage];
      messageRepository.findByConversation.mockResolvedValue(mockMessages);

      const result = await service.getMessages(mockConversationId, {
        conversationId: mockConversationId,
        page: 1,
        limit: 20,
        userId: mockUserId,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });
  });

  describe('getAttachments', () => {
    it('should return message attachments', async () => {
      messageRepository.findByIdAndTenant.mockResolvedValue(mockMessage);
      attachmentRepository.findByMessageId.mockResolvedValue([
        mockAttachment as AttachmentEntity,
      ]);

      const result = await service.getAttachments(mockMessageId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockAttachment.id);
      expect(result[0].fileName).toBe(mockAttachment.fileName);
    });
  });

  describe('addReaction', () => {
    it('should add reaction to message', async () => {
      const messageWithReaction = {
        ...mockMessage,
        reactions: [{ userId: mockUserId, emoji: '👍' }],
      };
      messageRepository.findByIdAndTenant.mockResolvedValue(mockMessage);
      messageRepository.save.mockResolvedValue(
        Object.assign(new MessageEntity(), messageWithReaction),
      );

      const result = await service.addReaction(mockMessageId, mockUserId, '👍');

      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0].emoji).toBe('👍');
    });
  });

  describe('markMessageAsRead', () => {
    it('should mark message as read', async () => {
      messageRepository.findByIdAndTenant.mockResolvedValue(mockMessage);
      messageRepository.save.mockResolvedValue(
        Object.assign(new MessageEntity(), {
          ...mockMessage,
          readBy: { [mockUserId]: new Date() },
        }),
      );

      await service.markMessageAsRead(mockMessageId, mockUserId);

      expect(messageRepository.save).toHaveBeenCalled();
    });
  });
});
