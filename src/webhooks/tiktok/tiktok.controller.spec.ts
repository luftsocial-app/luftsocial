import { Test, TestingModule } from '@nestjs/testing';
import { TiktokController } from './tiktok.controller';
import { PinoLogger } from 'nestjs-pino';

describe('TiktokController', () => {
  let controller: TiktokController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TiktokController],
      providers: [
        {
          provide: PinoLogger,
          useValue: {
            setContext: jest.fn(),
            info: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TiktokController>(TiktokController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
