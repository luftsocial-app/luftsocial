import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MessageService } from './message.service';
import { Message } from '../../entities/chats/message.entity';
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { TenantService } from '../../database/tenant.service';
import { Repository } from 'typeorm';
import * as Chance from 'chance';

const chance = new Chance();

describe('MessageService', () => {
  let service: MessageService;
  let messageRepository: Repository<Message>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        {
          provide: TenantService,
          useValue: {
            getTenantId: jest.fn().mockReturnValue('default'),
          },
        },
        {
          provide: getRepositoryToken(Message),
          useValue: {
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
    messageRepository = module.get<Repository<Message>>(
      getRepositoryToken(Message),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMessageHistory', () => {
    const mockMessages = [
      {
        id: chance.guid(),
        content: chance.sentence(),
        sender: { id: chance.guid() },
        createdAt: chance.date(),
        updatedAt: chance.date(),
      },
      {
        id: chance.guid(),
        content: chance.sentence(),
        sender: { id: chance.guid() },
        receiver: { id: chance.guid() },
        createdAt: chance.date(),
        updatedAt: chance.date(),
      },
    ] as Message[];

    it('should return message history successfully', async () => {
      const userId = chance.guid();
      const findSpy = jest
        .spyOn(messageRepository, 'find')
        .mockResolvedValue(mockMessages);

      const result = await service.getMessageHistory(userId);

      expect(findSpy).toHaveBeenCalledWith({
        where: [{ senderId: userId }],
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual({
        status: 1,
        data: mockMessages,
      });
    });

    it('should return empty array when no messages found', async () => {
      const userId = chance.guid();
      const findSpy = jest
        .spyOn(messageRepository, 'find')
        .mockResolvedValue([]);

      const result = await service.getMessageHistory(userId);

      expect(findSpy).toHaveBeenCalledWith({
        where: [{ senderId: userId }],
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual({
        status: 2,
        data: [],
      });
    });

    it('should throw HttpException with INTERNAL_SERVER_ERROR on database error', async () => {
      const userId = chance.guid();
      const findSpy = jest
        .spyOn(messageRepository, 'find')
        .mockRejectedValue(new Error('Database connection failed'));

      await expect(service.getMessageHistory(userId)).rejects.toEqual(
        new HttpException(
          'Database connection failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );

      expect(findSpy).toHaveBeenCalledWith({
        where: [{ senderId: userId }],
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('updateMessage', () => {
    it('should update a message successfully', async () => {
      const messageId = chance.guid();
      const userId = chance.guid();
      const tenantId = 'default';
      const originalContent = chance.sentence();
      const newContent = chance.sentence();

      const originalMessage = {
        id: messageId,
        content: originalContent,
        senderId: userId,
        tenantId,
        metadata: {
          editHistory: [],
        },
        isEdited: false,
        addEditHistory: jest.fn(function (content) {
          this.metadata.editHistory.push({
            content,
            editedAt: expect.any(Date),
          });
          this.isEdited = true;
        }),
      };

      jest
        .spyOn(messageRepository, 'findOne')
        .mockResolvedValue(originalMessage as any);
      jest.spyOn(messageRepository, 'save').mockResolvedValue({
        id: messageId,
        content: newContent,
        senderId: userId,
        tenantId,
        metadata: {
          editHistory: [
            { content: originalContent, editedAt: expect.any(Date) },
          ],
        },
        isEdited: true,
      } as any);

      const result = await service.updateMessage(
        messageId,
        { content: newContent },
        userId,
      );

      expect(messageRepository.findOne).toHaveBeenCalledWith({
        where: { id: messageId, tenantId: 'default' },
      });
      expect(originalMessage.addEditHistory).toHaveBeenCalledWith(
        originalContent,
      );
      expect(messageRepository.save).toHaveBeenCalledWith(originalMessage);
      expect(result.content).toBe(newContent);
      expect(result.isEdited).toBe(true);
      expect(result.metadata.editHistory).toBeTruthy();
    });

    it('should throw NotFoundException when message not found', async () => {
      jest.spyOn(messageRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.updateMessage(
          chance.guid(),
          { content: chance.sentence() },
          chance.guid(),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not the sender', async () => {
      const messageId = chance.guid();
      const originalUserId = chance.guid();
      const differentUserId = chance.guid();

      const originalMessage = {
        id: messageId,
        senderId: originalUserId,
        tenantId: 'default',
      };

      jest
        .spyOn(messageRepository, 'findOne')
        .mockResolvedValue(originalMessage as any);

      await expect(
        service.updateMessage(
          messageId,
          { content: chance.sentence() },
          differentUserId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
