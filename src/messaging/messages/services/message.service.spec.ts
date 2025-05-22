import { Test, TestingModule } from '@nestjs/testing';
import { MessageService } from './message.service';
import { MessageRepository } from '../repositories/message.repository';
import { AttachmentRepository } from '../repositories/attachment.repository';
import { ConversationService } from '../../conversations/services/conversation.service';
import {
  MessageStatus,
  MessageType,
} from '../../shared/enums/message-type.enum';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { MessageEntity } from '../entities/message.entity';
import { AttachmentEntity } from '../entities/attachment.entity';
import { PinoLogger } from 'nestjs-pino';
import { TenantService } from '../../../user-management/tenant.service';
import { ContentSanitizer } from '../../shared/utils/content-sanitizer';
import { CreateMessageDto, GetMessagesQueryDto, UpdateMessageDto } from '../dto/message.dto';
import { PaginationResponse } from '../../../common/dto/pagination.dto';

// Helper for deep mocks
type DeepMocked<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? jest.Mock : DeepMocked<T[K]>;
} & T;

describe('MessageService', () => {
  let service: MessageService;
  let messageRepositoryMock: DeepMocked<MessageRepository>;
  let attachmentRepositoryMock: DeepMocked<AttachmentRepository>;
  let conversationServiceMock: DeepMocked<ConversationService>;
  let tenantServiceMock: DeepMocked<TenantService>;
  let contentSanitizerMock: DeepMocked<ContentSanitizer>;
  let loggerMock: DeepMocked<PinoLogger>;

  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-123';
  const mockConversationId = 'conv-123';
  const mockMessageId = 'msg-123';

  const createMockMessage = (overrides: Partial<MessageEntity> = {}): MessageEntity => {
    const baseMessage = new MessageEntity();
    baseMessage.id = overrides.id || mockMessageId;
    baseMessage.conversationId = overrides.conversationId || mockConversationId;
    baseMessage.content = overrides.content || 'Test message';
    baseMessage.senderId = overrides.senderId || mockUserId;
    baseMessage.tenantId = overrides.tenantId || mockTenantId;
    baseMessage.status = overrides.status || MessageStatus.SENT;
    baseMessage.type = overrides.type || MessageType.TEXT;
    baseMessage.readBy = overrides.readBy || {};
    baseMessage.reactions = overrides.reactions || [];
    baseMessage.metadata = overrides.metadata || { reactions: {}, editHistory: [] };
    if (!baseMessage.metadata.reactions) baseMessage.metadata.reactions = {};
    if (!baseMessage.metadata.editHistory) baseMessage.metadata.editHistory = [];
    baseMessage.attachments = overrides.attachments || [];
    baseMessage.createdAt = overrides.createdAt || new Date();
    baseMessage.updatedAt = overrides.updatedAt || new Date();
    baseMessage.deletedAt = overrides.deletedAt || null;
    baseMessage.parentMessageId = overrides.parentMessageId || null;
    baseMessage.isEdited = overrides.isEdited || false;
    baseMessage.isDeleted = overrides.isDeleted || false;
    baseMessage.isPinned = overrides.isPinned || false;
    baseMessage.deletedBy = overrides.deletedBy || null;
    
    baseMessage.addEditHistory = jest.fn().mockImplementation(function(this: MessageEntity, content: string) {
        if (!this.metadata.editHistory) this.metadata.editHistory = [];
        this.metadata.editHistory.push({ content, editedAt: new Date() });
        this.isEdited = true;
    });
    baseMessage.addReaction = jest.fn().mockImplementation(function(this: MessageEntity, userId: string, emoji: string) {
        if (!this.reactions) this.reactions = [];
        this.reactions.push({ userId, emoji, createdAt: new Date(), id: `react-${Date.now()}`, messageId: this.id, tenantId: this.tenantId } as any);
    });
    baseMessage.removeReaction = jest.fn().mockImplementation(function(this: MessageEntity, userId: string, emoji?: string) {
        if (!this.reactions) return;
        this.reactions = this.reactions.filter(r => !(r.userId === userId && (emoji ? r.emoji === emoji : true)));
    });
    baseMessage.markAsRead = jest.fn().mockImplementation(function(this: MessageEntity, userId: string) {
        if (!this.readBy) this.readBy = {};
        this.readBy[userId] = new Date();
    });
    
    return baseMessage;
  };
  
  let mockMessage: MessageEntity;

  const mockAttachment: Partial<AttachmentEntity> = {
    id: 'attachment-123', messageId: mockMessageId, fileName: 'test.txt', fileSize: 1024, mimeType: 'text/plain', url: 'http://example.com/test.txt', processingStatus: 'completed', createdAt: new Date(),
  };

  beforeEach(async () => {
    mockMessage = createMockMessage(); 

    const pinoLoggerMockValue = {
        info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), setContext: jest.fn(), child: jest.fn().mockReturnThis(), trace: jest.fn(), fatal: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        { provide: MessageRepository, useValue: {
            create: jest.fn(), save: jest.fn(), findByIdAndTenant: jest.fn(), findByConversation: jest.fn(), findMessageHistory: jest.fn(), findThreadReplies: jest.fn(), update: jest.fn(), markAsDeleted: jest.fn(), count: jest.fn(), getUnreadCount: jest.fn(), findOne: jest.fn(),
        }},
        { provide: AttachmentRepository, useValue: { findByMessageId: jest.fn(), create: jest.fn(), save: jest.fn() }},
        { provide: ConversationService, useValue: { validateAccess: jest.fn(), updateLastMessageTimestamp: jest.fn(), isUserAdmin: jest.fn() }},
        { provide: TenantService, useValue: { getTenantId: jest.fn().mockResolvedValue(mockTenantId) }},
        { provide: ContentSanitizer, useValue: { sanitize: jest.fn(content => content), sanitizeRealtimeMessage: jest.fn(content => ({ isValid: true, sanitized: content })), sanitizeMetadata: jest.fn(metadata => metadata) }},
        { provide: PinoLogger, useValue: pinoLoggerMockValue },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
    messageRepositoryMock = module.get(MessageRepository);
    attachmentRepositoryMock = module.get(AttachmentRepository);
    conversationServiceMock = module.get(ConversationService);
    tenantServiceMock = module.get(TenantService);
    contentSanitizerMock = module.get(ContentSanitizer);
    loggerMock = module.get(PinoLogger);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createMessage', () => {
    const createDto: CreateMessageDto = { content: 'Test message', attachments: [], parentMessageId: null, metadata: {} };

    it('should create a message successfully', async () => {
      conversationServiceMock.validateAccess.mockResolvedValue(true);
      messageRepositoryMock.create.mockImplementation((entity) => createMockMessage(entity));
      messageRepositoryMock.save.mockResolvedValue(createMockMessage(createDto));

      const result = await service.createMessage(mockConversationId, createDto.content, mockUserId, createDto.attachments, createDto.parentMessageId, createDto.metadata);
      
      expect(result).toBeDefined();
      expect(result.content).toBe('Test message');
      expect(conversationServiceMock.updateLastMessageTimestamp).toHaveBeenCalledWith(mockConversationId);
      expect(tenantServiceMock.getTenantId).toHaveBeenCalledTimes(1);
      expect(contentSanititizerMock.sanitize).toHaveBeenCalledWith('Test message');
    });

    it('should handle sanitization failure', async () => {
      contentSanitizerMock.sanitize.mockReturnValue('');
      await expect(service.createMessage(mockConversationId, '<script>xss</script>', mockUserId)).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when user has no access', async () => {
      conversationServiceMock.validateAccess.mockResolvedValue(false);
      await expect(service.createMessage(mockConversationId, 'Test message', mockUserId)).rejects.toThrow(ForbiddenException);
    });

    it('should create a message with a valid parentMessageId', async () => {
      const parentMsg = createMockMessage({ id: 'parent-msg-id' });
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(parentMsg);
      conversationServiceMock.validateAccess.mockResolvedValue(true);
      messageRepositoryMock.create.mockImplementation((entity) => createMockMessage(entity));
      messageRepositoryMock.save.mockResolvedValue(createMockMessage({ parentMessageId: 'parent-msg-id' }));

      const result = await service.createMessage(mockConversationId, 'Reply', mockUserId, [], 'parent-msg-id');
      expect(tenantServiceMock.getTenantId).toHaveBeenCalledTimes(2);
      expect(messageRepositoryMock.findByIdAndTenant).toHaveBeenCalledWith('parent-msg-id', mockTenantId);
      expect(result.parentMessageId).toBe('parent-msg-id');
    });

    it('should throw NotFoundException if parentMessageId not found', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(null);
      conversationServiceMock.validateAccess.mockResolvedValue(true);
      await expect(service.createMessage(mockConversationId, 'Reply', mockUserId, [], 'non-existent-id')).rejects.toThrow(new NotFoundException('Parent message not found or in a different conversation.'));
    });
    
    it('should throw BadRequestException if parent message is in a different conversation', async () => {
      const parentMsg = createMockMessage({ id: 'parent-msg-id', conversationId: 'other-conv' });
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(parentMsg);
      conversationServiceMock.validateAccess.mockResolvedValue(true);
      await expect(service.createMessage(mockConversationId, 'Reply', mockUserId, [], 'parent-msg-id')).rejects.toThrow(new BadRequestException('Parent message not found or in a different conversation.'));
    });
  });
  
  describe('updateMessageStatus', () => {
    it('should update message status successfully', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(mockMessage);
      messageRepositoryMock.update.mockResolvedValue({ affected: 1 } as any);
      await service.updateMessageStatus(mockMessageId, MessageStatus.READ);
      expect(tenantServiceMock.getTenantId).toHaveBeenCalled();
      expect(messageRepositoryMock.findByIdAndTenant).toHaveBeenCalledWith(mockMessageId, mockTenantId);
      expect(messageRepositoryMock.update).toHaveBeenCalledWith({ id: mockMessageId, tenantId: mockTenantId }, { status: MessageStatus.READ });
    });

    it('should throw NotFoundException if message not found', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(null);
      await expect(service.updateMessageStatus(mockMessageId, MessageStatus.READ)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMessage', () => {
    const updateDto: UpdateMessageDto = { content: 'Updated content' };

    it('should update message successfully', async () => {
      const originalMessage = createMockMessage({ content: 'Original content' });
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(originalMessage);
      contentSanitizerMock.sanitize.mockReturnValue(updateDto.content);
      messageRepositoryMock.save.mockImplementation(async (msg: MessageEntity) => msg);

      const result = await service.updateMessage(mockMessageId, updateDto, mockUserId);
      
      expect(tenantServiceMock.getTenantId).toHaveBeenCalled();
      expect(messageRepositoryMock.findByIdAndTenant).toHaveBeenCalledWith(mockMessageId, mockTenantId);
      expect(contentSanitizerMock.sanitize).toHaveBeenCalledWith(updateDto.content);
      expect(originalMessage.addEditHistory).toHaveBeenCalledWith('Original content');
      expect(messageRepositoryMock.save).toHaveBeenCalledWith(originalMessage);
      expect(result.content).toBe(updateDto.content);
      expect(result.isEdited).toBe(true);
    });

    it('should throw NotFoundException if message not found', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(null);
      await expect(service.updateMessage(mockMessageId, updateDto, mockUserId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not sender', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(createMockMessage({ senderId: 'other-user' }));
      await expect(service.updateMessage(mockMessageId, updateDto, mockUserId)).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if message is deleted', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(createMockMessage({ deletedAt: new Date() }));
      await expect(service.updateMessage(mockMessageId, updateDto, mockUserId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid sanitized content', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(mockMessage);
      contentSanitizerMock.sanitize.mockReturnValue(''); // Invalid content
      await expect(service.updateMessage(mockMessageId, updateDto, mockUserId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteMessage', () => {
    it('should delete message successfully if user is sender', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(createMockMessage({ senderId: mockUserId }));
      await service.deleteMessage(mockMessageId, mockUserId);
      expect(messageRepositoryMock.markAsDeleted).toHaveBeenCalledWith(mockMessageId, mockUserId);
    });

    it('should delete message successfully if user is admin', async () => {
      conversationServiceMock.isUserAdmin.mockResolvedValue(true);
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(createMockMessage({ senderId: 'other-user' }));
      await service.deleteMessage(mockMessageId, mockUserId); // mockUserId is admin
      expect(conversationServiceMock.isUserAdmin).toHaveBeenCalledWith(mockUserId, mockConversationId);
      expect(messageRepositoryMock.markAsDeleted).toHaveBeenCalledWith(mockMessageId, mockUserId);
    });

    it('should throw NotFoundException if message not found', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(null);
      await expect(service.deleteMessage(mockMessageId, mockUserId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not sender and not admin', async () => {
      conversationServiceMock.isUserAdmin.mockResolvedValue(false);
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(createMockMessage({ senderId: 'other-user' }));
      await expect(service.deleteMessage(mockMessageId, mockUserId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMessages', () => {
    const query: GetMessagesQueryDto = { page: 1, limit: 10, userId: mockUserId };
    
    it('should return messages with unreadCount if query.userId is provided', async () => {
      conversationServiceMock.validateAccess.mockResolvedValue(true);
      messageRepositoryMock.findByConversation.mockResolvedValue([mockMessage]);
      messageRepositoryMock.count.mockResolvedValue(1);
      messageRepositoryMock.getUnreadCount.mockResolvedValue(0);

      const result = await service.getMessages(mockConversationId, query);
      expect(result.messages[0]).toEqual(mockMessage);
      expect(result.total).toBe(1);
      expect(result.unreadCount).toBe(0);
      expect(messageRepositoryMock.getUnreadCount).toHaveBeenCalledWith(mockConversationId, mockUserId, mockTenantId);
    });
    
    it('should return messages without unreadCount if query.userId is NOT provided', async () => {
        const queryNoUser: GetMessagesQueryDto = { page: 1, limit: 10 };
        conversationServiceMock.validateAccess.mockResolvedValue(true); // Should not be called
        messageRepositoryMock.findByConversation.mockResolvedValue([mockMessage]);
        messageRepositoryMock.count.mockResolvedValue(1);
  
        const result = await service.getMessages(mockConversationId, queryNoUser);
        expect(result.messages[0]).toEqual(mockMessage);
        expect(result.total).toBe(1);
        expect(result.unreadCount).toBeUndefined();
        expect(conversationServiceMock.validateAccess).not.toHaveBeenCalled();
        expect(messageRepositoryMock.getUnreadCount).not.toHaveBeenCalled();
      });

    it('should throw ForbiddenException if validateAccess fails', async () => {
      conversationServiceMock.validateAccess.mockResolvedValue(false);
      await expect(service.getMessages(mockConversationId, query)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMessageHistory', () => {
    it('should retrieve message history', async () => {
      const history = [{ content: 'Old', editedAt: new Date() }];
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(createMockMessage({ metadata: { reactions: {}, editHistory: history } }));
      const result = await service.getMessageHistory(mockMessageId);
      expect(result).toEqual(history);
    });

    it('should return empty array for no history', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(createMockMessage({ metadata: { reactions: {}, editHistory: [] } }));
      const result = await service.getMessageHistory(mockMessageId);
      expect(result).toEqual([]);
    });
    
    it('should return empty array if metadata or editHistory is null/undefined', async () => {
        messageRepositoryMock.findByIdAndTenant.mockResolvedValue(createMockMessage({ metadata: null }));
        expect(await service.getMessageHistory(mockMessageId)).toEqual([]);
        
        messageRepositoryMock.findByIdAndTenant.mockResolvedValue(createMockMessage({ metadata: { editHistory: undefined } as any }));
        expect(await service.getMessageHistory(mockMessageId)).toEqual([]);
    });

    it('should throw NotFoundException if message not found', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(null);
      await expect(service.getMessageHistory(mockMessageId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addReaction', () => {
    it('should add a reaction', async () => {
      const localMsg = createMockMessage({ reactions: [] });
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(localMsg);
      messageRepositoryMock.save.mockImplementation(async m => m);
      
      const result = await service.addReaction(mockMessageId, mockUserId, '👍');
      expect(localMsg.addReaction).toHaveBeenCalledWith(mockUserId, '👍');
      expect(messageRepositoryMock.save).toHaveBeenCalledWith(localMsg);
      expect(result.reactions.some(r => r.emoji === '👍')).toBe(true);
    });

    it('should throw NotFoundException if message not found', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(null);
      await expect(service.addReaction(mockMessageId, mockUserId, '👍')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if message deleted', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(createMockMessage({ deletedAt: new Date() }));
      await expect(service.addReaction(mockMessageId, mockUserId, '👍')).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeReaction', () => {
    it('should remove a reaction', async () => {
      const localMsg = createMockMessage({ reactions: [{ userId: mockUserId, emoji: '👍' } as any] });
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(localMsg);
      messageRepositoryMock.save.mockImplementation(async m => m);

      const result = await service.removeReaction(mockMessageId, mockUserId, '👍');
      expect(localMsg.removeReaction).toHaveBeenCalledWith(mockUserId, '👍');
      expect(messageRepositoryMock.save).toHaveBeenCalledWith(localMsg);
      expect(result.reactions.some(r => r.emoji === '👍')).toBe(false);
    });
    
    it('should throw NotFoundException if message not found', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(null);
      await expect(service.removeReaction(mockMessageId, mockUserId, '👍')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if message deleted', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(createMockMessage({ deletedAt: new Date() }));
      await expect(service.removeReaction(mockMessageId, mockUserId, '👍')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAttachments', () => {
    it('should return attachments', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(mockMessage);
      attachmentRepositoryMock.findByMessageId.mockResolvedValue([mockAttachment as AttachmentEntity]);
      const result = await service.getAttachments(mockMessageId);
      expect(result[0]).toEqual(mockAttachment);
    });

    it('should throw NotFoundException if message not found', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(null);
      await expect(service.getAttachments(mockMessageId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getThreadReplies', () => {
    const parentId = 'parent-msg-id';
    const query = { page: 1, limit: 10 };
    it('should return thread replies', async () => {
      messageRepositoryMock.findOne.mockResolvedValue(createMockMessage({ id: parentId }));
      messageRepositoryMock.findThreadReplies.mockResolvedValue([mockMessage]);
      const result = await service.getThreadReplies(parentId, query);
      expect(result[0]).toEqual(mockMessage);
      expect(messageRepositoryMock.findOne).toHaveBeenCalledWith({ where: { id: parentId, tenantId: mockTenantId } });
      expect(messageRepositoryMock.findThreadReplies).toHaveBeenCalledWith(parentId, mockTenantId, query);
    });

    it('should throw NotFoundException if parent message not found', async () => {
      messageRepositoryMock.findOne.mockResolvedValue(null);
      await expect(service.getThreadReplies(parentId, query)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findMessageById', () => {
    it('should return a message by ID', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(mockMessage);
      const result = await service.findMessageById(mockMessageId);
      expect(result).toEqual(mockMessage);
    });

    it('should throw NotFoundException if message not found', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(null);
      await expect(service.findMessageById(mockMessageId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markMessageAsRead', () => {
    it('should mark a message as read', async () => {
      const localMsg = createMockMessage();
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(localMsg);
      messageRepositoryMock.save.mockImplementation(async m => m);
      await service.markMessageAsRead(mockMessageId, mockUserId);
      expect(localMsg.markAsRead).toHaveBeenCalledWith(mockUserId);
      expect(messageRepositoryMock.save).toHaveBeenCalledWith(localMsg);
    });

    it('should throw NotFoundException if message not found', async () => {
      messageRepositoryMock.findByIdAndTenant.mockResolvedValue(null);
      await expect(service.markMessageAsRead(mockMessageId, mockUserId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      conversationServiceMock.validateAccess.mockResolvedValue(true);
      messageRepositoryMock.getUnreadCount.mockResolvedValue(5);
      const result = await service.getUnreadCount(mockConversationId, mockUserId);
      expect(result).toBe(5);
      expect(messageRepositoryMock.getUnreadCount).toHaveBeenCalledWith(mockConversationId, mockUserId, mockTenantId);
    });

    it('should throw ForbiddenException if no access', async () => {
      conversationServiceMock.validateAccess.mockResolvedValue(false);
      await expect(service.getUnreadCount(mockConversationId, mockUserId)).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException on repository error', async () => {
      conversationServiceMock.validateAccess.mockResolvedValue(true);
      const error = new Error("DB Error");
      messageRepositoryMock.getUnreadCount.mockRejectedValue(error);
      await expect(service.getUnreadCount(mockConversationId, mockUserId)).rejects.toThrow(BadRequestException);
      expect(loggerMock.error).toHaveBeenCalledWith(error, expect.any(String), mockConversationId, mockUserId);
    });
  });
});
