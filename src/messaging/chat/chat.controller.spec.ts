import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

jest.mock('./chat.service', () => {
  return {
    ChatService: jest.fn().mockImplementation(() => {
      return {
        createConversation: jest.fn(),
        getConversations: jest.fn(),
        getConversationsByUserId: jest.fn(),
        createMessage: jest.fn(),
        validateAccess: jest.fn(),
      };
    }),
  };
});

describe('ChatController', () => {
  let controller: ChatController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [ChatService],
    }).compile();

    controller = module.get<ChatController>(ChatController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
