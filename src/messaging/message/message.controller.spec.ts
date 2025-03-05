import { Test, TestingModule } from '@nestjs/testing';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { HttpStatus } from '@nestjs/common';
import * as Chance from 'chance';
import { Message } from '../../entities/chats/message.entity';
import { ChatService } from '../chat/chat.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { OperationStatus } from '../../common/enums/operation-status.enum';

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
            updateMessage: jest.fn(),
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

  describe('updateMessage', () => {
    const mockReq = { user: { id: 'user123' } };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const messageId = chance.guid();
    const updateDto = { content: 'Updated content' };

    it('should update a message successfully', async () => {
      const updatedMessage = {
        id: messageId,
        content: updateDto.content,
        senderId: mockReq.user.id,
        isEdited: true,
        metadata: {
          editHistory: [{ content: 'Original content', editedAt: new Date() }],
        },
      };

      const updateMessageSpy = jest
        .spyOn(messageService, 'updateMessage')
        .mockResolvedValue(updatedMessage as any);

      await controller.updateMessage(
        mockReq.user,
        messageId,
        updateDto,
        mockRes as any,
      );

      expect(updateMessageSpy).toHaveBeenCalledWith(
        messageId,
        updateDto,
        mockReq.user.id,
      );
      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Message updated successfully',
        data: updatedMessage,
        status: OperationStatus.Success,
      });
    });

    it('should handle not found error', async () => {
      jest
        .spyOn(messageService, 'updateMessage')
        .mockRejectedValue(new NotFoundException('Message not found'));

      await controller.updateMessage(
        mockReq,
        messageId,
        updateDto,
        mockRes as any,
      );

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Message not found',
        status: OperationStatus.NotFound,
      });
    });

    it('should handle forbidden error', async () => {
      jest
        .spyOn(messageService, 'updateMessage')
        .mockRejectedValue(
          new ForbiddenException('You can only edit your own messages'),
        );

      await controller.updateMessage(
        mockReq,
        messageId,
        updateDto,
        mockRes as any,
      );

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'You can only edit your own messages',
        status: OperationStatus.Unauthorized,
      });
    });

    it('should handle general errors', async () => {
      jest
        .spyOn(messageService, 'updateMessage')
        .mockRejectedValue(new Error('Unexpected error'));

      await controller.updateMessage(
        mockReq,
        messageId,
        updateDto,
        mockRes as any,
      );

      expect(mockRes.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Failed to update message',
        error: 'Unexpected error',
        status: OperationStatus.Failed,
      });
    });
  });
});
