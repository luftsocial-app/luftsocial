import { Test, TestingModule } from '@nestjs/testing';
import { MessageService } from './message.service';
import { Message } from '../entities/message.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('MessageService', () => {
  let service: MessageService;
  let repository: Repository<Message>;

  // Mock the repository
  const mockMessageRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        {
          provide: getRepositoryToken(Message),
          useValue: mockMessageRepository,
        },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
    repository = module.get<Repository<Message>>(getRepositoryToken(Message));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMessageHistory', () => {
    it('should return message history successfully', async () => {
      const userId = 1;

      const mockMessages = [
        {
          id: 1,
          senderId: 1,
          receiverId: 2,
          content: 'Test message 1',
          sentAt: new Date(),
        },
        {
          id: 2,
          senderId: 2,
          receiverId: 1,
          content: 'Test message 2',
          sentAt: new Date(),
        },
      ];

      mockMessageRepository.find.mockResolvedValue(mockMessages);

      const result = await service.getMessageHistory(userId);

      expect(result.status).toBe(1);
      expect(result.data).toEqual(mockMessages);
      expect(mockMessageRepository.find).toHaveBeenCalledWith({
        where: [{ senderId: userId }, { receiverId: userId }],
        order: { sentAt: 'ASC' },
      });
    });

    it('should return an empty array when no messages are found', async () => {
      const userId = 1;

      // Mock the repository to return an empty array
      mockMessageRepository.find.mockResolvedValue([]);

      const result = await service.getMessageHistory(userId);

      expect(result.status).toBe(0);
      expect(result.data).toEqual([]);
      expect(mockMessageRepository.find).toHaveBeenCalledWith({
        where: [{ senderId: userId }, { receiverId: userId }],
        order: { sentAt: 'ASC' },
      });
    });

    it('should throw an error if something goes wrong', async () => {
      const userId = 1;

      // Mock the repository to throw an error
      mockMessageRepository.find.mockRejectedValue(new Error('Database error'));

      try {
        await service.getMessageHistory(userId);
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.status).toBe(HttpStatus.BAD_REQUEST);
        expect(err.message).toBe('Database error');
      }
    });
  });
});
