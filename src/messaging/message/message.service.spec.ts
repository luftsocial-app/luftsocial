import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MessageService } from './message.service';
import { Message } from '../../entities/chats/message.entity';
import { HttpException } from '@nestjs/common';
import { TenantService } from '../../database/tenant.service';

describe('MessageService', () => {
  let service: MessageService;

  const mockMessageRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        TenantService,
        {
          provide: getRepositoryToken(Message),
          useValue: mockMessageRepository,
        },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMessageHistory', () => {
    it('should return message history successfully', async () => {
      const mockMessages = [
        {
          id: '1',
          content: 'Test message 1',
          sender: { id: '1' },
          createdAt: new Date(),
        },
        {
          id: '2',
          content: 'Test message 2',
          sender: { id: '1' },
          createdAt: new Date(),
        },
      ];

      mockMessageRepository.find.mockResolvedValue(mockMessages);

      const result = await service.getMessageHistory('1');

      expect(result.status).toBe(1);
      expect(result.data).toEqual(mockMessages);
      expect(mockMessageRepository.find).toHaveBeenCalledWith({
        where: [{ sender: { id: '1' } }],
        order: { createdAt: 'ASC' },
      });
    });

    it('should return status 1 when no messages found', async () => {
      mockMessageRepository.find.mockResolvedValue([]);

      const result = await service.getMessageHistory('1');

      expect(result).toEqual({
        status: 1,
        data: [],
      });

      expect(mockMessageRepository.find).toHaveBeenCalledWith({
        where: [{ sender: { id: '1' } }],
        order: { createdAt: 'ASC' },
      });
    });

    it('should throw HttpException on error', async () => {
      mockMessageRepository.find.mockRejectedValue(new Error('Database error'));

      await expect(service.getMessageHistory('1')).rejects.toThrow(
        HttpException,
      );
    });
  });
});
