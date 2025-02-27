import { Test, TestingModule } from '@nestjs/testing';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { HttpStatus } from '@nestjs/common';
import * as Chance from 'chance';
import { Message } from '../../database/entities/chats/message.entity';
import { ChatService } from '../chat/chat.service';

const chance = new Chance();

describe('MessageController', () => {
  let controller: MessageController;
  let messageService: MessageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessageController],
      providers: [
        {
          provide: ChatService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: MessageService,
          useValue: {
            getMessageHistory: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MessageController>(MessageController);
    messageService = module.get<MessageService>(MessageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMessageHistory', () => {
    const mockReq = {};
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    it('should return message history', async () => {
      const mockMessages = Array.from({ length: 3 }, () => ({
        id: chance.integer({ min: 1, max: 1000 }),
        content: chance.paragraph(),
        senderId: chance.guid(),
        receiverId: chance.guid(),
        createdAt: chance.date(),
        updatedAt: chance.date(),
      })) as unknown as Message[];

      const getMessageHistorySpy = jest
        .spyOn(messageService, 'getMessageHistory')
        .mockResolvedValue({
          status: 1,
          data: mockMessages,
        });

      const userId = chance.guid();
      await controller.getMessageHistory(
        mockReq as any,
        userId,
        mockRes as any,
      );

      expect(getMessageHistorySpy).toHaveBeenCalledWith(userId);
      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Message history fetched successfully.',
        status: 1,
        data: mockMessages,
      });
    });

    it('should handle empty message history', async () => {
      const getMessageHistorySpy = jest
        .spyOn(messageService, 'getMessageHistory')
        .mockResolvedValue({
          status: 1,
          data: [],
        });

      const userId = chance.guid();
      await controller.getMessageHistory(
        mockReq as any,
        userId,
        mockRes as any,
      );

      expect(getMessageHistorySpy).toHaveBeenCalledWith(userId);
      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Message history fetched successfully.',
        status: 1,
        data: [],
      });
    });

    it('should handle service errors with appropriate status code', async () => {
      const mockError = new Error('Service error');
      const getMessageHistorySpy = jest
        .spyOn(messageService, 'getMessageHistory')
        .mockRejectedValue(mockError);

      const userId = chance.guid();
      await controller.getMessageHistory(
        mockReq as any,
        userId,
        mockRes as any,
      );

      expect(getMessageHistorySpy).toHaveBeenCalledWith(userId);
      expect(mockRes.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'An error occurred while fetching message history.',
        error: mockError.message,
      });
    });

    it('should handle invalid user id format', async () => {
      const invalidUserId = 'invalid-id';
      const mockError = new Error('Invalid user ID');
      const getMessageHistorySpy = jest
        .spyOn(messageService, 'getMessageHistory')
        .mockRejectedValue(mockError);

      await controller.getMessageHistory(
        mockReq as any,
        invalidUserId,
        mockRes as any,
      );

      expect(getMessageHistorySpy).toHaveBeenCalledWith(invalidUserId);
      expect(mockRes.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'An error occurred while fetching message history.',
        error: mockError.message,
      });
    });
  });
});
