import { Test, TestingModule } from '@nestjs/testing';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { MessageDto, MessageTypeEnum, StatusEnum } from '../dto/base.dto';

describe('MessageController', () => {
    let controller: MessageController;
    let service: MessageService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [MessageController],
            providers: [
                {
                    provide: MessageService,
                    useValue: {
                        getMessageHistory: jest.fn(),
                    },
                },
            ],
        }).compile();

        controller = module.get<MessageController>(MessageController);
        service = module.get<MessageService>(MessageService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getMessageHistory', () => {
        it('should return message history successfully', async () => {
            const userId = "1";
            const res: Partial<Response> = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            const mockMessages: MessageDto[] = [
                {
                    id: "1",
                    senderId: "1",
                    receiverId: "2",
                    groupId: "1",
                    type: MessageTypeEnum.text,
                    content: 'Test message',
                    isRead: false,
                    status: StatusEnum.sent,
                    sentAt: new Date(),
                    isDeleted: false,
                },
            ];

            jest.spyOn(service, 'getMessageHistory').mockResolvedValue({
                data: mockMessages,
                status: 1,
            });

            await controller.getMessageHistory({} as any, userId, res as Response);

            expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Message history fetched successfully.',
                status: 1,
                data: [
                    {
                        id: "1",
                        content: 'Test message',
                        senderId: "1",
                        receiverId: "2",
                        groupId: "1",
                        isRead: false,
                        status: 'sent',
                        sentAt: expect.any(Date),
                        isDeleted: false,
                        type: 'text',
                    },
                ],
            });
        });

        it('should return an error when service fails', async () => {
            const userId = "1";
            const res: Partial<Response> = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            jest.spyOn(service, 'getMessageHistory').mockRejectedValue(new Error('Service error'));

            await controller.getMessageHistory({} as any, userId, res as Response);

            expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
            expect(res.json).toHaveBeenCalledWith({
                message: 'An error occurred while fetching message history.',
                error: 'Service error',
            });
        });
    });
});
