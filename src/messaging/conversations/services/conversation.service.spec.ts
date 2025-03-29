/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { ConversationService } from './conversation.service';
import { TenantService } from '../../../user-management/tenant/tenant.service';
import { ConversationRepository } from '../repositories/conversation.repository';
import { ParticipantRepository } from '../repositories/participant.repository';
import { MessageRepository } from '../../messages/repositories/message.repository';
import { Repository } from 'typeorm';
import { User } from '../../../entities/users/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConversationType } from '../../shared/enums/conversation-type.enum';
import { NotFoundException } from '@nestjs/common';

describe('ConversationService', () => {
  let service: ConversationService;
  let tenantService: TenantService;
  let conversationRepository: ConversationRepository;
  let participantRepository: ParticipantRepository;
  let messageRepository: MessageRepository;
  let userRepository: Repository<User>;

  const mockTenantId = 'test-tenant-id';

  // Mock test data
  const mockUser1 = {
    id: 'user-1',
    username: 'user1',
  } as User;

  const mockUser2 = {
    id: 'user-2',
    username: 'user2',
  } as User;

  const mockConversation = {
    id: 'conv-1',
    name: 'Test Conversation',
    type: ConversationType.GROUP,
    tenantId: mockTenantId,
    participants: [],
    messages: [],
    isPrivate: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock repositories
  const mockConversationRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findByTenant: jest.fn(),
    findByUserId: jest.fn(),
    updateLastMessageTimestamp: jest.fn(),
    findDirectConversation: jest.fn(),
  };

  const mockParticipantRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findByUserAndConversation: jest.fn(),
  };

  const mockMessageRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockUserRepo = {
    findBy: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        {
          provide: TenantService,
          useValue: { getTenantId: () => mockTenantId },
        },
        {
          provide: ConversationRepository,
          useValue: mockConversationRepo,
        },
        {
          provide: ParticipantRepository,
          useValue: mockParticipantRepo,
        },
        {
          provide: MessageRepository,
          useValue: mockMessageRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
      ],
    }).compile();

    service = module.get<ConversationService>(ConversationService);
    tenantService = module.get<TenantService>(TenantService);
    conversationRepository = module.get<ConversationRepository>(
      ConversationRepository,
    );
    participantRepository = module.get<ParticipantRepository>(
      ParticipantRepository,
    );
    messageRepository = module.get<MessageRepository>(MessageRepository);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createConversation', () => {
    const createConversationDto = {
      name: 'Test Group',
      type: ConversationType.GROUP,
      participantIds: [mockUser1.id, mockUser2.id],
      creatorId: mockUser1.id,
      isPrivate: false,
    };

    it('should create a new conversation successfully', async () => {
      mockUserRepo.findBy.mockResolvedValue([mockUser1, mockUser2]);
      mockConversationRepo.create.mockReturnValue(mockConversation);
      mockConversationRepo.save.mockResolvedValue(mockConversation);
      mockParticipantRepo.create.mockImplementation((data) => data);
      mockParticipantRepo.save.mockImplementation((data) => data);

      const result = await service.createConversation(createConversationDto);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockConversation.id);
      expect(mockUserRepo.findBy).toHaveBeenCalled();
      expect(mockConversationRepo.create).toHaveBeenCalled();
      expect(mockParticipantRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when no users found', async () => {
      mockUserRepo.findBy.mockResolvedValue([]);

      await expect(
        service.createConversation(createConversationDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getConversations', () => {
    it('should return all conversations for tenant', async () => {
      const mockConversations = [mockConversation];
      mockConversationRepo.findByTenant.mockResolvedValue(mockConversations);

      const result = await service.getConversations();

      expect(result).toEqual(mockConversations);
      expect(mockConversationRepo.findByTenant).toHaveBeenCalledWith(
        mockTenantId,
      );
    });
  });

  describe('getConversationsByUserId', () => {
    it('should return conversations for specific user', async () => {
      const mockConversations = [mockConversation];
      mockConversationRepo.findByUserId.mockResolvedValue(mockConversations);

      const result = await service.getConversationsByUserId(mockUser1.id);

      expect(result).toEqual(mockConversations);
      expect(mockConversationRepo.findByUserId).toHaveBeenCalledWith(
        mockUser1.id,
        mockTenantId,
      );
    });
  });

  describe('createMessage', () => {
    it('should create a new message and update conversation', async () => {
      const mockMessage = {
        id: 'msg-1',
        content: 'Test message',
        conversationId: mockConversation.id,
        senderId: mockUser1.id,
      };

      mockMessageRepo.create.mockReturnValue(mockMessage);
      mockMessageRepo.save.mockResolvedValue(mockMessage);
      mockConversationRepo.updateLastMessageTimestamp.mockResolvedValue(
        undefined,
      );

      const result = await service.createMessage(
        mockConversation.id,
        'Test message',
        mockUser1.id,
      );

      expect(result).toEqual(mockMessage);
      expect(mockMessageRepo.create).toHaveBeenCalled();
      expect(mockMessageRepo.save).toHaveBeenCalled();
      expect(
        mockConversationRepo.updateLastMessageTimestamp,
      ).toHaveBeenCalledWith(mockConversation.id);
    });
  });

  describe('validateAccess', () => {
    it('should return true for valid access', async () => {
      const mockParticipant = {
        status: 'member',
        conversation: { tenantId: mockTenantId },
      };

      mockParticipantRepo.findByUserAndConversation.mockResolvedValue(
        mockParticipant,
      );

      const result = await service.validateAccess(
        mockConversation.id,
        mockUser1.id,
        mockTenantId,
      );

      expect(result).toBe(true);
      expect(
        mockParticipantRepo.findByUserAndConversation,
      ).toHaveBeenCalledWith(mockUser1.id, mockConversation.id);
    });

    it('should return false for invalid access', async () => {
      mockParticipantRepo.findByUserAndConversation.mockResolvedValue(null);

      const result = await service.validateAccess(
        mockConversation.id,
        mockUser1.id,
        mockTenantId,
      );

      expect(result).toBe(false);
    });
  });

  describe('createOrGetDirectChat', () => {
    it('should return existing direct chat if found', async () => {
      const mockDirectChat = {
        ...mockConversation,
        type: ConversationType.DIRECT,
      };

      mockConversationRepo.findDirectConversation.mockResolvedValue(
        mockDirectChat,
      );

      const result = await service.createOrGetDirectChat(
        mockUser1.id,
        mockUser2.id,
      );

      expect(result).toEqual(mockDirectChat);
      expect(mockConversationRepo.findDirectConversation).toHaveBeenCalledWith(
        mockUser1.id,
        mockUser2.id,
        mockTenantId,
      );
    });

    it('should create new direct chat if not found', async () => {
      mockConversationRepo.findDirectConversation.mockResolvedValue(null);
      mockUserRepo.findBy.mockResolvedValue([mockUser1, mockUser2]);

      const mockDirectChat = {
        ...mockConversation,
        type: ConversationType.DIRECT,
      };

      mockConversationRepo.create.mockReturnValue(mockDirectChat);
      mockConversationRepo.save.mockResolvedValue(mockDirectChat);
      mockParticipantRepo.create.mockImplementation((data) => data);
      mockParticipantRepo.save.mockImplementation((data) => data);

      const result = await service.createOrGetDirectChat(
        mockUser1.id,
        mockUser2.id,
      );

      expect(result).toBeDefined();
      expect(result.type).toBe(ConversationType.DIRECT);
      expect(mockUserRepo.findBy).toHaveBeenCalled();
      expect(mockConversationRepo.create).toHaveBeenCalled();
      expect(mockParticipantRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when users not found', async () => {
      mockConversationRepo.findDirectConversation.mockResolvedValue(null);
      mockUserRepo.findBy.mockResolvedValue([mockUser1]); // Only one user found

      await expect(
        service.createOrGetDirectChat(mockUser1.id, 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createGroupChat', () => {
    it('should create a new group chat', async () => {
      const participantIds = [mockUser2.id];
      mockUserRepo.findBy.mockResolvedValue([mockUser1, mockUser2]);

      const mockGroupChat = {
        ...mockConversation,
        type: ConversationType.GROUP,
      };

      mockConversationRepo.create.mockReturnValue(mockGroupChat);
      mockConversationRepo.save.mockResolvedValue(mockGroupChat);
      mockParticipantRepo.create.mockImplementation((data) => data);
      mockParticipantRepo.save.mockImplementation((data) => data);

      const result = await service.createGroupChat(
        'Test Group',
        participantIds,
        mockUser1.id,
      );

      expect(result).toBeDefined();
      expect(result.type).toBe(ConversationType.GROUP);
      expect(mockUserRepo.findBy).toHaveBeenCalled();
      expect(mockConversationRepo.create).toHaveBeenCalled();
      expect(mockParticipantRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when users not found', async () => {
      mockUserRepo.findBy.mockResolvedValue([mockUser1]); // Only creator found

      await expect(
        service.createGroupChat('Test Group', ['invalid-id'], mockUser1.id),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
