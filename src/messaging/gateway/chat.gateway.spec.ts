import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { ChatService } from '../chat/chat.service';
import { Socket } from 'socket.io';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let chatService: ChatService;

  const mockUser = {
    id: 'user1',
    username: 'testuser',
    tenantId: 'tenant1',
  };

  const mockClient = {
    data: { user: mockUser },
    join: jest.fn(),
    leave: jest.fn(),
  } as unknown as Socket;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: ChatService,
          useValue: {
            getConversationsByUserId: jest.fn(),
            validateAccess: jest.fn(),
            createMessage: jest.fn(),
            getConversation: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    chatService = module.get<ChatService>(ChatService);
    gateway.server = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    } as any;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should handle new connection', async () => {
      const mockConversations = [{ id: 'conv1' }, { id: 'conv2' }];

      jest
        .spyOn(chatService, 'getConversationsByUserId')
        .mockResolvedValue(mockConversations as any);

      await gateway.handleConnection(mockClient);

      expect(mockClient.join).toHaveBeenCalledWith(`user_${mockUser.id}`);
      mockConversations.forEach((conv) => {
        expect(mockClient.join).toHaveBeenCalledWith(`conversation_${conv.id}`);
      });
    });
  });

  describe('handleMessage', () => {
    it('should handle new message', async () => {
      const payload = {
        conversationId: 'conv1',
        content: 'Hello',
      };

      const mockMessage = {
        id: 'msg1',
        ...payload,
        createdAt: new Date(),
      };

      const mockConversation = {
        id: payload.conversationId,
      };

      jest.spyOn(chatService, 'validateAccess').mockResolvedValue(true);
      jest
        .spyOn(chatService, 'createMessage')
        .mockResolvedValue(mockMessage as any);
      jest
        .spyOn(chatService, 'getConversation')
        .mockResolvedValue(mockConversation as any);

      const result = await gateway.handleMessage(mockClient, payload);

      expect(result).toEqual({ success: true, messageId: mockMessage.id });
      expect(chatService.validateAccess).toHaveBeenCalledWith(
        payload.conversationId,
        mockUser.id,
        mockUser.tenantId,
      );
      expect(gateway.server.to).toHaveBeenCalledWith(
        `conversation_${payload.conversationId}`,
      );
    });

    it('should reject message if no access', async () => {
      const payload = {
        conversationId: 'conv1',
        content: 'Hello',
      };

      jest.spyOn(chatService, 'validateAccess').mockResolvedValue(false);

      const result = await gateway.handleMessage(mockClient, payload);

      expect(result).toEqual({ error: 'Access denied to this conversation' });
    });
  });

  describe('handleTyping', () => {
    it('should emit typing event', async () => {
      const conversationId = 'conv1';

      await gateway.handleTyping(mockClient, conversationId);

      expect(gateway.server.to).toHaveBeenCalledWith(
        `conversation_${conversationId}`,
      );
    });
  });
});
