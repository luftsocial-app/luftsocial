import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConversationType } from '../../database/entities/chats/conversation.entity';
import * as Chance from 'chance';

const chance = new Chance();

describe('ChatController', () => {
  let controller: ChatController;
  let service: ChatService;

  const mockUser = {
    id: chance.guid(),
    username: chance.name(),
    email: chance.email(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: {
            createOrGetDirectChat: jest.fn(),
            createGroupChat: jest.fn(),
            getConversationsByUserId: jest.fn(),
            getConversation: jest.fn(),
            addParticipantsToGroup: jest.fn(),
            createMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createOrGetDirectChat', () => {
    it('should create or get direct chat', async () => {
      const otherUserId = chance.guid();
      const expectedChat = {
        id: chance.guid(),
        type: ConversationType.DIRECT,
        participants: [
          { id: mockUser.id, username: chance.name() },
          { id: otherUserId, username: chance.name() },
        ],
        createdAt: chance.date(),
      };

      jest
        .spyOn(service, 'createOrGetDirectChat')
        .mockResolvedValue(expectedChat as any);

      const result = await controller.createOrGetDirectChat(
        { user: mockUser },
        otherUserId,
      );

      expect(result).toEqual(expectedChat);
      expect(service.createOrGetDirectChat).toHaveBeenCalledWith(
        mockUser.id,
        otherUserId,
      );
    });
  });

  describe('createGroupChat', () => {
    it('should create a group chat', async () => {
      const createGroupDto = {
        name: chance.word(),
        participantIds: [chance.guid(), chance.guid()],
      };
      const expectedGroup = {
        id: chance.guid(),
        name: createGroupDto.name,
        type: ConversationType.GROUP,
        participants: [
          { id: mockUser.id },
          ...createGroupDto.participantIds.map((id) => ({
            id,
            username: chance.name(),
          })),
        ],
        createdAt: chance.date(),
      };

      jest
        .spyOn(service, 'createGroupChat')
        .mockResolvedValue(expectedGroup as any);

      const result = await controller.createGroupChat(
        { user: mockUser },
        createGroupDto,
      );

      expect(result).toEqual(expectedGroup);
      expect(service.createGroupChat).toHaveBeenCalledWith(
        createGroupDto.name,
        createGroupDto.participantIds,
        mockUser.id,
      );
    });
  });

  describe('getMyConversations', () => {
    it('should get user conversations', async () => {
      const expectedConversations = Array.from({ length: 3 }, () => ({
        id: chance.guid(),
        name: chance.word(),
        type: chance.pickone([ConversationType.DIRECT, ConversationType.GROUP]),
        participants: Array.from(
          { length: chance.integer({ min: 2, max: 5 }) },
          () => ({
            id: chance.guid(),
            username: chance.name(),
          }),
        ),
        lastMessage: {
          id: chance.guid(),
          content: chance.sentence(),
          createdAt: chance.date(),
        },
      }));

      jest
        .spyOn(service, 'getConversationsByUserId')
        .mockResolvedValue(expectedConversations as any);

      const result = await controller.getMyConversations({ user: mockUser });

      expect(result).toEqual(expectedConversations);
      expect(service.getConversationsByUserId).toHaveBeenCalledWith(
        mockUser.id,
      );
    });
  });

  describe('addParticipantsToGroup', () => {
    it('should add participants to group chat', async () => {
      const groupId = chance.guid();
      const participantIds = [chance.guid(), chance.guid()];
      const expectedResult = {
        id: groupId,
        participants: [
          { id: mockUser.id },
          { id: participantIds[0] },
          { id: participantIds[1] },
        ],
      };

      jest
        .spyOn(service, 'addParticipantsToGroup')
        .mockResolvedValue(expectedResult as any);

      const result = await controller.addParticipantsToGroup(
        { user: mockUser },
        groupId,
        { participantIds },
      );

      expect(result).toEqual(expectedResult);
      expect(service.addParticipantsToGroup).toHaveBeenCalledWith(
        groupId,
        participantIds,
        mockUser.id,
      );
    });
  });

  describe('getConversation', () => {
    it('should get conversation by id', async () => {
      const conversationId = chance.guid();
      const expectedConversation = {
        id: conversationId,
        participants: [{ id: mockUser.id }],
        messages: [],
      };

      jest
        .spyOn(service, 'getConversation')
        .mockResolvedValue(expectedConversation as any);

      const result = await controller.getConversation(conversationId);

      expect(result).toEqual(expectedConversation);
      expect(service.getConversation).toHaveBeenCalledWith(conversationId);
    });
  });

  describe('createMessage', () => {
    it('should create message in conversation', async () => {
      const conversationId = chance.guid();
      const content = chance.sentence();
      const expectedMessage = {
        id: chance.guid(),
        content,
        conversationId,
        sender: mockUser,
      };

      jest
        .spyOn(service, 'createMessage')
        .mockResolvedValue(expectedMessage as any);

      const result = await controller.createMessage(
        { user: mockUser },
        conversationId,
        { content },
      );

      expect(result).toEqual(expectedMessage);
      expect(service.createMessage).toHaveBeenCalledWith(
        conversationId,
        content,
        mockUser.id,
      );
    });
  });
});
