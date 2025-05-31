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
import { MessageInboxEntity } from '../entities/inbox.entity';
import {
  AttachmentEntity,
  AttachmentStatus,
} from '../entities/attachment.entity';
import { PinoLogger } from 'nestjs-pino';
import { TenantService } from '../../../user-management/tenant.service';
import { ContentSanitizer } from '../../shared/utils/content-sanitizer';
import { MessagingGateway } from '../../realtime/gateways/messaging.gateway';
import { MediaStorageService } from '../../../asset-management/media-storage/media-storage.service';
import { DataSource, QueryRunner } from 'typeorm';
import { ParticipantRepository } from '../../conversations/repositories/participant.repository';
import { MessageInboxRepository } from '../repositories/inbox.repository';
import { UploadType } from '../../../common/enums/upload.enum';
import { lookup } from 'mime-types';

describe('MessageService', () => {
  let service: MessageService;
  let messageRepository: jest.Mocked<MessageRepository>;
  let inboxRepository: jest.Mocked<MessageInboxRepository>;
  let attachmentRepository: jest.Mocked<AttachmentRepository>;
  let conversationService: jest.Mocked<ConversationService>;
  let contentSanitizer: ContentSanitizer;
  let queryRunner: jest.Mocked<QueryRunner>;
  let messagingGateway: jest.Mocked<MessagingGateway>;
  let tenantService: jest.Mocked<TenantService>;
  let mediaStorageService: jest.Mocked<MediaStorageService>;

  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-123';
  const mockConversationId = 'conv-123';
  const mockMessageId = 'msg-123';
  const mockFileName = 'test.png';
  const mockUploadSessionId = 'session-123';
  const mockDetectedMimeType = 'image/png';

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

  const unreadMessages: MessageInboxEntity[] = [
    {
      id: 'inbox-1',
      recipientId: mockUserId,
      conversationId: mockConversationId,
      messageId: 'msg-1',
      message: undefined as any,
      read: false,
      readAt: null,
      delivered: false,
      deliveredAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      tenantId: mockTenantId,
    },
    {
      id: 'inbox-2',
      recipientId: mockUserId,
      conversationId: mockConversationId,
      messageId: 'msg-2',
      message: undefined as any,
      read: false,
      readAt: null,
      delivered: false,
      deliveredAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      tenantId: mockTenantId,
    },
  ];

  const mockAttachment: Partial<AttachmentEntity> = {
    id: 'attachment-123',
    messageId: mockMessageId,
    fileName: mockFileName,
    fileSize: 1024,
    mimeType: mockDetectedMimeType,
    url: 'http://example.com/test.txt',
    createdAt: new Date(),
    tenantId: mockTenantId,
    userId: mockUserId,
    publicUrl: 'http://example.com/test.txt',
    uploadSessionId: mockUploadSessionId,
  };

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    // Create a mock QueryRunner with proper typing
    queryRunner = {
      manager: {
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      },
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      isTransactionActive: false,
      isReleased: false,
      isConnected: true,
    } as unknown as jest.Mocked<QueryRunner>;

    // Create a mock server for the messaging gateway
    const mockServer = {
      in: jest.fn().mockReturnThis(),
      emit: jest.fn().mockReturnThis(),
      fetchSockets: jest.fn().mockResolvedValue([]),
      sockets: {
        sockets: new Map(),
      },
      to: jest.fn().mockReturnThis(),
    };

    // Create a mock DataSource
    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
      manager: {
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        {
          provide: MessagingGateway,
          useValue: {
            server: mockServer,
          },
        },
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
            getUnreadCount: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: AttachmentRepository,
          useValue: {
            findByMessageId: jest.fn(),
            findOneBy: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getMany: jest.fn(),
            save: jest.fn(),
            create: jest.fn().mockImplementation((entity) => entity),
          },
        },
        {
          provide: ParticipantRepository,
          useValue: {
            findByIdAndTenant: jest.fn(),
            findByConversation: jest.fn(),
            findMessageHistory: jest.fn(),
            findThreadReplies: jest.fn(),
            update: jest.fn(),
            markAsDeleted: jest.fn(),
            count: jest.fn(),
            getUnreadCount: jest.fn(),
            findOne: jest.fn(),
            findByConversationId: jest.fn(),
          },
        },
        {
          provide: MessageInboxRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findByIdAndTenant: jest.fn(),
            createForRecipients: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: ConversationService,
          useValue: {
            validateAccess: jest.fn().mockResolvedValue(true),
            updateLastMessageTimestamp: jest.fn(),
          },
        },
        {
          provide: TenantService,
          useValue: {
            getTenantId: jest.fn().mockReturnValue(mockTenantId),
          },
        },
        {
          provide: ContentSanitizer,
          useValue: {
            sanitize: jest.fn().mockImplementation((content) => content),
            sanitizeRealtimeMessage: jest
              .fn()
              .mockImplementation((content) => ({
                isValid: true,
                sanitized: content,
              })),
            sanitizeMetadata: jest
              .fn()
              .mockImplementation((metadata) => metadata),
          },
        },
        {
          provide: MediaStorageService,
          useValue: {
            generatePreSignedUrl: jest.fn().mockResolvedValue({
              key: 'test-key',
              url: 'http://test-url.com',
              cdnUrl: 'http://cdn.test-url.com',
              preSignedUrl: 'http://presigned.test-url.com',
            }),
            getFileMetadata: jest.fn().mockResolvedValue({
              ContentLength: 1024,
            }),
            verifyUpload: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: PinoLogger,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            setContext: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
    messageRepository = module.get(MessageRepository);
    inboxRepository = module.get(MessageInboxRepository);
    attachmentRepository = module.get(AttachmentRepository);
    conversationService = module.get(ConversationService);
    tenantService = module.get(TenantService);
    contentSanitizer = module.get(ContentSanitizer);
    messagingGateway = module.get(MessagingGateway);
    mediaStorageService = module.get(MediaStorageService);
  });

  describe('createMessage', () => {
    // Update the test to properly mock the query runner and its manager
    it('should create a message successfully', async () => {
      console.log('Starting test: should create a message successfully');

      // Setup mocks
      const validateAccessSpy = jest
        .spyOn(conversationService, 'validateAccess')
        .mockImplementation(async () => {
          console.log('validateAccess called');
          return true;
        });

      // Create a mock message that will be returned by save
      const savedMessage = new MessageEntity();
      Object.assign(savedMessage, {
        ...mockMessage,
        id: mockMessageId,
        content: 'Test message',
        senderId: mockUserId,
        conversationId: mockConversationId,
        status: MessageStatus.SENT,
        tenantId: mockTenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log('Created savedMessage:', savedMessage);

      // Mock the query runner's manager.save
      const mockSave = jest.fn().mockImplementation((entity) => {
        console.log('mockSave called with:', entity);
        return Promise.resolve(savedMessage);
      });
      queryRunner.manager.save = mockSave;

      // Mock the message repository
      const createSpy = jest
        .spyOn(messageRepository, 'create')
        .mockImplementation((data) => {
          console.log('messageRepository.create called with:', data);
          return Object.assign(new MessageEntity(), data);
        });

      // Mock the WebSocket server method chaining
      const mockSockets = [
        { id: 'socket-1', data: { userId: 'user-1' } },
        { id: 'socket-2', data: { userId: 'user-2' } },
      ];

      console.log('Mocking WebSocket server...');

      // Create mock functions for WebSocket methods
      const mockFetchSockets = jest.fn().mockResolvedValue(mockSockets);
      const mockEmit = jest.fn().mockReturnThis();

      // Create a mock for the server.in() method chain
      const mockInReturn = {
        fetchSockets: mockFetchSockets,
      };

      // Create a mock for the server.to() method chain
      const mockToReturn = {
        emit: mockEmit,
      };

      // Create a typed mock server
      const mockServer = {
        // Socket.io Server methods
        in: jest.fn().mockReturnValue(mockInReturn),
        to: jest.fn().mockReturnValue(mockToReturn),
        emit: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        use: jest.fn(),
        // Other required server properties
        sockets: new Map(),
        fetchSockets: jest.fn(),
      };

      // Assign the mock server to the gateway
      messagingGateway.server = mockServer as any;

      // Mock the tenant service
      jest.spyOn(tenantService, 'getTenantId').mockImplementation(() => {
        console.log('getTenantId called, returning:', mockTenantId);
        return mockTenantId;
      });

      // Mock the sanitize method
      jest.spyOn(contentSanitizer, 'sanitize').mockImplementation((content) => {
        console.log('sanitize called with:', content);
        return content; // Return content as-is for testing
      });

      // Mock the updateLastMessageTimestamp method
      jest
        .spyOn(conversationService, 'updateLastMessageTimestamp')
        .mockImplementation(async (conversationId) => {
          console.log(
            'updateLastMessageTimestamp called with:',
            conversationId,
          );
          return Promise.resolve();
        });

      // Execute
      const result = await service.createMessage(
        mockConversationId,
        'Test message',
        mockUserId,
      );

      // Verify
      expect(result).toBeDefined();
      expect(result.id).toBe(mockMessageId);
      expect(result.content).toBe('Test message');

      // Verify access was validated
      expect(validateAccessSpy).toHaveBeenCalledWith(
        mockConversationId,
        mockUserId,
        mockTenantId,
      );

      // Verify query runner was used correctly
      expect(queryRunner.connect).toHaveBeenCalled();
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();

      // Verify message was created with correct data
      expect(createSpy).toHaveBeenCalledWith({
        conversationId: mockConversationId,
        content: 'Test message',
        senderId: mockUserId,
        status: MessageStatus.SENT,
        tenantId: mockTenantId,
      });

      // Verify message was saved through the transaction with the correct properties
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Test message',
          conversationId: mockConversationId,
          senderId: mockUserId,
          status: MessageStatus.SENT,
          tenantId: mockTenantId,
        }),
      );

      // Verify conversation was updated
      expect(
        conversationService.updateLastMessageTimestamp,
      ).toHaveBeenCalledWith(mockConversationId);
    });

    it('should handle sanitization failure', async () => {
      jest.spyOn(contentSanitizer, 'sanitize').mockReturnValue('');

      await expect(
        service.createMessage(
          mockConversationId,
          '<script>alert("xss")</script>',
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
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

    it('should handle sanitization failure during update', async () => {
      messageRepository.findByIdAndTenant.mockResolvedValue(mockMessage);
      jest.spyOn(contentSanitizer, 'sanitize').mockReturnValue('');

      await expect(
        service.updateMessage(
          mockMessageId,
          { content: '<script>alert("xss")</script>' },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
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
      const totalMessages = 1;

      messageRepository.findByConversation.mockResolvedValue(mockMessages);
      messageRepository.count.mockResolvedValue(totalMessages);
      conversationService.validateAccess.mockResolvedValue(true);

      const result = await service.getMessages(mockConversationId, {
        conversationId: mockConversationId,
        page: 1,
        limit: 20,
        userId: mockUserId,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.total).toBe(totalMessages);
      expect(result.page).toBe(1);
      expect(messageRepository.findByConversation).toHaveBeenCalledWith(
        mockConversationId,
        expect.objectContaining({
          page: 1,
          limit: 20,
        }),
      );
      expect(conversationService.validateAccess).toHaveBeenCalledWith(
        mockConversationId,
        mockUserId,
        mockTenantId,
      );
    });

    it('should throw ForbiddenException when user has no access', async () => {
      conversationService.validateAccess.mockResolvedValue(false);
      messageRepository.findByConversation.mockResolvedValue([mockMessage]);

      await expect(
        service.getMessages(mockConversationId, {
          conversationId: mockConversationId,
          page: 1,
          limit: 20,
          userId: mockUserId,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(conversationService.validateAccess).toHaveBeenCalledWith(
        mockConversationId,
        mockUserId,
        mockTenantId,
      );
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

  describe('markInboxMessagesAsRead', () => {
    it('should mark all unread inbox messages as read and save them', async () => {
      inboxRepository.find.mockResolvedValue([
        Object.assign(new MessageInboxEntity(), unreadMessages[0]),
        Object.assign(new MessageInboxEntity(), unreadMessages[1]),
      ]);
      inboxRepository.save.mockResolvedValue(undefined);

      await service.markInboxMessagesAsRead(mockUserId, mockConversationId);

      expect(inboxRepository.find).toHaveBeenCalledWith({
        where: {
          recipientId: mockUserId,
          conversationId: mockConversationId,
          read: false,
        },
      });
      expect(inboxRepository.save).toHaveBeenCalledTimes(unreadMessages.length);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count for conversation', async () => {
      conversationService.validateAccess.mockResolvedValue(true);
      messageRepository.getUnreadCount.mockResolvedValue(5);

      const result = await service.getUnreadCount(
        mockConversationId,
        mockUserId,
      );

      expect(result).toBe(5);
      expect(conversationService.validateAccess).toHaveBeenCalledWith(
        mockConversationId,
        mockUserId,
        mockTenantId,
      );
      expect(messageRepository.getUnreadCount).toHaveBeenCalledWith(
        mockConversationId,
        mockUserId,
      );
    });

    it('should throw ForbiddenException when user has no access', async () => {
      conversationService.validateAccess.mockResolvedValue(false);

      await expect(
        service.getUnreadCount(mockConversationId, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should wrap unknown errors in BadRequestException', async () => {
      conversationService.validateAccess.mockResolvedValue(true);
      messageRepository.getUnreadCount.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.getUnreadCount(mockConversationId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  it('should throw BadRequestException if mime type is not detected', async () => {
    const userId = mockUserId;
    const fileName = 'file.unknown';
    const conversationId = mockConversationId;
    const uploadSessionId = 'session-123';

    jest.spyOn(tenantService, 'getTenantId').mockReturnValue(mockTenantId);
    conversationService.validateAccess.mockResolvedValue(true);

    const lookupSpy = jest.spyOn({ lookup }, 'lookup').mockReturnValue(false);

    const loggerSpy = jest.spyOn(service['logger'], 'debug');

    await expect(
      service.prepareAttachment(
        userId,
        fileName,
        conversationId,
        uploadSessionId,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(loggerSpy).toHaveBeenCalledWith(
      `Failed to detect MIME type for ${fileName}`,
    );
    lookupSpy.mockRestore();
  });

  describe('prepareAttachment', () => {
    it('should prepare an attachment and return presigned url and attachment details', async () => {
      // Arrange
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(mockTenantId);
      conversationService.validateAccess.mockResolvedValue(true);

      const lookupSpy = jest
        .spyOn({ lookup }, 'lookup')
        .mockReturnValue(mockDetectedMimeType);

      const presignedMock = {
        key: 'file-key',
        url: 'http://example.com/url',
        cdnUrl: 'http://example.com/cdn',
        preSignedUrl: 'http://example.com/presigned',
        bucket: 'luftsocial-assets',
        assetId: 'asset-123',
      } as const;
      mediaStorageService.generatePreSignedUrl.mockResolvedValue(presignedMock);

      const attachmentMock: any = {
        ...mockAttachment,
        id: 'attachment-id',
        fileKey: presignedMock.key,
        mimeType: mockDetectedMimeType,
        type: 'image',
        status: AttachmentStatus.PENDING,
        publicUrl: presignedMock.cdnUrl,
        uploadSessionId: mockUploadSessionId,
      };
      attachmentRepository.create.mockReturnValue(attachmentMock);
      attachmentRepository.save.mockResolvedValue(attachmentMock);

      const result = await service.prepareAttachment(
        mockUserId,
        mockFileName,
        mockConversationId,
        mockUploadSessionId,
      );

      expect(conversationService.validateAccess).toHaveBeenCalledWith(
        mockConversationId,
        mockUserId,
        mockTenantId,
      );
      expect(mediaStorageService.generatePreSignedUrl).toHaveBeenCalledWith(
        mockUserId,
        mockFileName,
        mockDetectedMimeType,
        undefined,
        undefined,
        UploadType.MESSAGE,
        mockConversationId,
      );
      expect(attachmentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: mockFileName,
          mimeType: mockDetectedMimeType,
          fileKey: presignedMock.key,
          userId: mockUserId,
          status: AttachmentStatus.PENDING,
          tenantId: mockTenantId,
          publicUrl: presignedMock.cdnUrl,
          metadata: { originalName: mockFileName },
          messageId: null,
          conversationId: mockConversationId,
          uploadSessionId: mockUploadSessionId,
        }),
      );
      expect(attachmentRepository.save).toHaveBeenCalledWith(attachmentMock);

      expect(result).toEqual({
        presignedUrl: presignedMock.preSignedUrl,
        attachmentId: attachmentMock.id,
        fileKey: presignedMock.key,
        cdnUrl: presignedMock.cdnUrl,
        conversationId: mockConversationId,
      });

      lookupSpy.mockRestore();
    });

    it('should throw BadRequestException if mime type is not detected', async () => {
      jest.spyOn(tenantService, 'getTenantId').mockReturnValue(mockTenantId);
      conversationService.validateAccess.mockResolvedValue(true);
      const lookupSpy = jest.spyOn({ lookup }, 'lookup').mockReturnValue(false);

      const loggerSpy = jest.spyOn(service['logger'], 'debug');

      await expect(
        service.prepareAttachment(
          mockUserId,
          'file.unknown',
          mockConversationId,
          mockUploadSessionId,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(loggerSpy).toHaveBeenCalledWith(
        `Failed to detect MIME type for file.unknown`,
      );
      lookupSpy.mockRestore();
    });
  });
});
