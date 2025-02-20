import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { TenantService } from '../../database/tenant.service';

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

describe('ChatController', () => {
  let controller: ChatController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [ChatService, TenantService],
    }).compile();

    controller = module.get<ChatController>(ChatController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
