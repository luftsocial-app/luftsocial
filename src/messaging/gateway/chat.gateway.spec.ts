import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { ChatService } from '../chat/chat.service';
import { MessageService } from '../message/message.service';
import { TenantService } from '../../database/tenant.service';
import { PinoLogger } from 'nestjs-pino';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Message } from '../../entities/chats/message.entity';

jest.mock('../../database/tenant.service.ts', () => {
  return {
    TenantService: jest.fn().mockImplementation(() => {
      return {
        getTenantId: jest.fn(),
        setTenantId: jest.fn(),
      };
    }),
  };
});

jest.mock('../chat/chat.service', () => {
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

describe('ChatGateway', () => {
  let gateway: ChatGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        ChatService,
        MessageService,
        TenantService,
        { provide: PinoLogger, useValue: jest.fn() },
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

    gateway = module.get<ChatGateway>(ChatGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
