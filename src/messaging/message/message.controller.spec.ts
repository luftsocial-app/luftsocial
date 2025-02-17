import { Test, TestingModule } from '@nestjs/testing';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { HttpStatus } from '@nestjs/common';
import * as Chance from 'chance';
import { ChatService } from '../chat/chat.service';

const chance = new Chance();

describe('MessageController', () => {
  let controller: MessageController;

  const mockMessageService = {
    getMessageHistory: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessageController],
      providers: [
        ChatService,
        {
          provide: MessageService,
          useValue: mockMessageService,
        },
      ],
    }).compile();

    controller = module.get<MessageController>(MessageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMessageHistory', () => {
    it('should return message history', async () => {
      const mockMessages = Array.from({ length: 3 }, () => ({
        id: chance.integer({ min: 1, max: 1000 }),
        content: chance.paragraph(),
        senderId: chance.guid(),
        receiverId: chance.guid(),
        createdAt: chance.date(),
        updatedAt: chance.date(),
      }));

      const mockReq = {};
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      mockMessageService.getMessageHistory.mockResolvedValue({
        status: 1,
        data: mockMessages,
      });

      await controller.getMessageHistory(
        mockReq as any,
        chance.guid(),
        mockRes as any,
      );

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Message history fetched successfully.',
        status: 1,
        data: mockMessages,
      });
    });

    it('should handle errors', async () => {
      const mockReq = {};
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const mockError = new Error(chance.sentence());
      mockMessageService.getMessageHistory.mockRejectedValue(mockError);

      await controller.getMessageHistory(
        mockReq as any,
        chance.guid(),
        mockRes as any,
      );

      expect(mockRes.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'An error occurred while fetching message history.',
        error: mockError.message,
      });
    });

    it('should handle empty message history', async () => {
      const mockReq = {};
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      mockMessageService.getMessageHistory.mockResolvedValue({
        status: 1,
        data: [],
      });

      await controller.getMessageHistory(
        mockReq as any,
        chance.guid(),
        mockRes as any,
      );

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Message history fetched successfully.',
        status: 1,
        data: [],
      });
    });

    it('should handle invalid user id', async () => {
      const mockReq = {};
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      mockMessageService.getMessageHistory.mockRejectedValue(
        new Error('Invalid user ID'),
      );

      await controller.getMessageHistory(
        mockReq as any,
        'invalid-id',
        mockRes as any,
      );

      expect(mockRes.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });
  });
});
