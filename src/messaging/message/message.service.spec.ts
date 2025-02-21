import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MessageService } from './message.service';
import { Message } from '../../entities/chats/message.entity';
import { HttpException, HttpStatus } from '@nestjs/common';
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
            getCurrentTenantId: jest.fn().mockReturnValue('default'),
          },
        },
        {
          provide: getRepositoryToken(Message),
          useValue: {
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
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
});
