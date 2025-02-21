import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { TenantService } from '../../database/tenant.service';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Conversation } from '../../entities/chats/conversation.entity';
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

const mockTenantService = {
  getTenantId: jest.fn().mockReturnValue('tenant123'),
};

const mockRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
};

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: TenantService,
          useValue: mockTenantService,
        },
        {
          provide: getRepositoryToken(Message),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(Conversation),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
