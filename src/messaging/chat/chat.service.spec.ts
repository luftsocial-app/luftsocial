import { Test, TestingModule } from '@nestjs/testing';
import { Repository, In } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import {
  Conversation,
  ConversationType,
} from '../../database/entities/chats/conversation.entity';
import { Message } from '../../database/entities/chats/message.entity';
import { User } from '../../database/entities/users/user.entity';
import { TenantService } from '../../database/tenant.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import * as Chance from 'chance';

const chance = new Chance();

describe('ChatService', () => {
  let service: ChatService;
  let conversationRepository: Repository<Conversation>;
  let messageRepository: Repository<Message>;
  let userRepository: Repository<User>;

  const mockTenantId = chance.guid();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getRepositoryToken(Conversation),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              innerJoin: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              groupBy: jest.fn().mockReturnThis(),
              having: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getMany: jest.fn(),
              getOne: jest.fn(),
            })),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Message),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findBy: jest.fn(),
            findOneBy: jest.fn(),
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

    service = module.get<ChatService>(ChatService);
    conversationRepository = module.get<Repository<Conversation>>(
      getRepositoryToken(Conversation),
    );
    messageRepository = module.get<Repository<Message>>(
      getRepositoryToken(Message),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createConversation', () => {
    it('should create a new conversation', async () => {
      const mockParticipants = [
        { id: chance.guid(), username: chance.name() },
        { id: chance.guid(), username: chance.name() },
      ] as User[];

      const createConversationDto = {
        name: chance.word(),
        type: ConversationType.GROUP,
        participantIds: mockParticipants.map((p) => p.id),
        isPrivate: false,
      };

      const mockConversation = {
        id: chance.guid(),
        name: createConversationDto.name,
        type: createConversationDto.type,
        participants: mockParticipants,
        tenantId: mockTenantId,
        admins: [],
        messages: [],
        metadata: {},
        createdAt: chance.date(),
        updatedAt: chance.date(),
        lastMessageAt: null,
        settings: {} as any,
        isPrivate: createConversationDto.isPrivate,
        lastReadMessageIds: {},
        unreadCounts: {},
      } as unknown as Conversation;

      jest.spyOn(userRepository, 'findBy').mockResolvedValue(mockParticipants);
      jest
        .spyOn(conversationRepository, 'create')
        .mockReturnValue(mockConversation);
      jest
        .spyOn(conversationRepository, 'save')
        .mockResolvedValue(mockConversation);

      const result = await service.createConversation(createConversationDto);

      expect(result).toEqual(mockConversation);
      expect(userRepository.findBy).toHaveBeenCalledWith({
        id: In(createConversationDto.participantIds),
      });
    });
  });

  describe('createOrGetDirectChat', () => {
    it('should return existing direct chat if it exists', async () => {
      const userId1 = 'user1';
      const userId2 = 'user2';
      const existingChat = { id: 'chat1', type: ConversationType.DIRECT };

      jest
        .spyOn(conversationRepository, 'createQueryBuilder')
        .mockImplementation(
          () =>
            ({
              innerJoin: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              groupBy: jest.fn().mockReturnThis(),
              having: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(existingChat),
            }) as any,
        );

      const result = await service.createOrGetDirectChat(userId1, userId2);

      expect(result).toEqual(existingChat);
    });

    it('should create new direct chat if it does not exist', async () => {
      const userId1 = 'user1';
      const userId2 = 'user2';
      const users = [{ id: userId1 }, { id: userId2 }] as User[];
      const newChat = {
        id: 'chat1',
        type: ConversationType.DIRECT,
        participants: users,
      };

      jest
        .spyOn(conversationRepository, 'createQueryBuilder')
        .mockImplementation(
          () =>
            ({
              innerJoin: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              groupBy: jest.fn().mockReturnThis(),
              having: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(null),
            }) as any,
        );

      jest.spyOn(userRepository, 'findBy').mockResolvedValue(users);
      jest
        .spyOn(conversationRepository, 'create')
        .mockReturnValue(newChat as Conversation);
      jest
        .spyOn(conversationRepository, 'save')
        .mockResolvedValue(newChat as Conversation);

      const result = await service.createOrGetDirectChat(userId1, userId2);

      expect(result).toEqual(newChat);
      expect(userRepository.findBy).toHaveBeenCalled();
      expect(conversationRepository.create).toHaveBeenCalled();
      expect(conversationRepository.save).toHaveBeenCalled();
    });
  });

  describe('createMessage', () => {
    it('should create a new message and update conversation', async () => {
      const conversationId = chance.guid();
      const content = chance.sentence();
      const senderId = chance.guid();
      const newMessage = {
        id: chance.guid(),
        content,
        conversationId,
        senderId,
        tenantId: mockTenantId,
        createdAt: chance.date(),
      };

      jest
        .spyOn(messageRepository, 'create')
        .mockReturnValue(newMessage as Message);
      jest
        .spyOn(messageRepository, 'save')
        .mockResolvedValue(newMessage as Message);
      jest
        .spyOn(conversationRepository, 'update')
        .mockResolvedValue({ affected: 1 } as any);

      const result = await service.createMessage(
        conversationId,
        content,
        senderId,
      );

      expect(result).toEqual(newMessage);
      expect(messageRepository.create).toHaveBeenCalledWith({
        conversationId,
        content,
        senderId,
        tenantId: mockTenantId,
      });
      expect(conversationRepository.update).toHaveBeenCalled();
    });
  });

  describe('getConversation', () => {
    it('should return conversation with relations', async () => {
      const mockConversation = {
        id: chance.guid(),
        name: chance.word(),
        participants: [
          { id: chance.guid(), username: chance.name() },
          { id: chance.guid(), username: chance.name() },
        ],
        messages: Array.from({ length: 3 }, () => ({
          id: chance.guid(),
          content: chance.sentence(),
          createdAt: chance.date(),
        })),
        admins: [{ id: chance.guid(), username: chance.name() }],
        createdAt: chance.date(),
        updatedAt: chance.date(),
      };

      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(mockConversation as any);

      const result = await service.getConversation(mockConversation.id);
      expect(result).toEqual(mockConversation);
    });

    it('should throw NotFoundException when conversation not found', async () => {
      const nonExistentId = chance.guid();
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(null);

      await expect(service.getConversation(nonExistentId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addParticipantsToGroup', () => {
    it('should add participants to group chat', async () => {
      const mockConversation = {
        id: chance.guid(),
        name: chance.word(),
        type: ConversationType.GROUP,
        participants: [{ id: chance.guid(), username: chance.name() }],
        admins: [{ id: chance.guid(), username: chance.name() }],
      };

      const newParticipants = Array.from({ length: 2 }, () => ({
        id: chance.guid(),
        username: chance.name(),
      }));

      const updatedConversation = {
        ...mockConversation,
        participants: [...mockConversation.participants, ...newParticipants],
      };

      jest
        .spyOn(service, 'getConversation')
        .mockResolvedValue(mockConversation as any);
      jest
        .spyOn(userRepository, 'findBy')
        .mockResolvedValue(newParticipants as User[]);
      jest
        .spyOn(conversationRepository, 'save')
        .mockResolvedValue(updatedConversation as any);

      const result = await service.addParticipantsToGroup(
        mockConversation.id,
        newParticipants.map((p) => p.id),
        mockConversation.admins[0].id,
      );

      expect(result.participants).toHaveLength(3);
    });

    it('should throw ConflictException when adding to direct chat', async () => {
      const mockDirectChat = {
        id: 'chat1',
        type: ConversationType.DIRECT,
        admins: [{ id: 'admin1' }],
      };

      jest
        .spyOn(service, 'getConversation')
        .mockResolvedValue(mockDirectChat as any);

      await expect(
        service.addParticipantsToGroup('chat1', ['user2'], 'admin1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when non-admin tries to add participants', async () => {
      const mockGroupChat = {
        id: 'group1',
        type: ConversationType.GROUP,
        admins: [{ id: 'admin1' }],
      };

      jest
        .spyOn(service, 'getConversation')
        .mockResolvedValue(mockGroupChat as any);

      await expect(
        service.addParticipantsToGroup('group1', ['user2'], 'non-admin'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('validateAccess', () => {
    it('should return true for valid participant', async () => {
      const userId = chance.guid();
      const mockConversation = {
        id: chance.guid(),
        participants: [{ id: userId, username: chance.name() }],
        tenantId: mockTenantId,
      };

      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(mockConversation as any);

      const result = await service.validateAccess(
        mockConversation.id,
        userId,
        mockTenantId,
      );
      expect(result).toBe(true);
    });

    it('should return false for non-participant', async () => {
      const mockConversation = {
        id: 'conv1',
        participants: [{ id: 'user1' }],
        tenantId: mockTenantId,
      };

      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(mockConversation as any);

      const result = await service.validateAccess(
        'conv1',
        'user2',
        mockTenantId,
      );
      expect(result).toBe(false);
    });

    it('should return false for non-existent conversation', async () => {
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(null);

      const result = await service.validateAccess(
        'nonexistent',
        'user1',
        mockTenantId,
      );
      expect(result).toBe(false);
    });
  });

  describe('getConversationsByUserId', () => {
    it('should return user conversations with messages', async () => {
      const userId = chance.guid();
      const mockConversations = Array.from({ length: 2 }, () => ({
        id: chance.guid(),
        name: chance.word(),
        participants: [{ id: userId, username: chance.name() }],
        messages: Array.from({ length: 3 }, () => ({
          id: chance.guid(),
          content: chance.sentence(),
          createdAt: chance.date(),
        })),
        createdAt: chance.date(),
        lastMessageAt: chance.date(),
      }));

      const queryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockConversations),
      };

      jest
        .spyOn(conversationRepository, 'createQueryBuilder')
        .mockReturnValue(queryBuilder as any);

      const result = await service.getConversationsByUserId(userId);
      expect(result).toEqual(mockConversations);
      expect(result).toHaveLength(2);
      expect(result[0].messages).toHaveLength(3);
    });
  });

  describe('markMessageAsRead', () => {
    it('should mark message as read and update conversation unread count', async () => {
      const messageId = chance.guid();
      const userId = chance.guid();
      const conversationId = chance.guid();

      const mockMessage = {
        id: messageId,
        conversationId,
        readBy: {},
        markAsRead: jest.fn(),
      } as unknown as Message;

      const mockConversation = {
        id: conversationId,
        unreadCounts: { [userId]: 1 },
      } as unknown as Conversation;

      jest.spyOn(messageRepository, 'findOne').mockResolvedValue(mockMessage);
      jest.spyOn(messageRepository, 'save').mockResolvedValue(mockMessage);
      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(mockConversation);
      jest
        .spyOn(conversationRepository, 'save')
        .mockResolvedValue(mockConversation);

      await service.markMessageAsRead(messageId, userId);

      expect(mockMessage.markAsRead).toHaveBeenCalledWith(userId);
      expect(mockConversation.unreadCounts[userId]).toBe(0);
    });

    it('should throw NotFoundException when message not found', async () => {
      jest.spyOn(messageRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.markMessageAsRead(chance.guid(), chance.guid()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count for user in conversation', async () => {
      const conversationId = chance.guid();
      const userId = chance.guid();
      const unreadCount = chance.integer({ min: 0, max: 10 });

      const mockConversation = {
        id: conversationId,
        unreadCounts: { [userId]: unreadCount },
      } as unknown as Conversation;

      jest
        .spyOn(conversationRepository, 'findOne')
        .mockResolvedValue(mockConversation);

      const result = await service.getUnreadCount(conversationId, userId);
      expect(result).toBe(unreadCount);
    });

    it('should return 0 when conversation not found', async () => {
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(null);

      const result = await service.getUnreadCount(chance.guid(), chance.guid());
      expect(result).toBe(0);
    });
  });
});
