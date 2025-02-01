import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import * as config from 'config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Users } from '../entities/user.entity';

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          isGlobal: true,
          load: [config.util.toObject],
        }),
        LoggerModule.forRoot(config.get('logger')),
      ],
      providers: [
        UserService,
        {
          provide: getRepositoryToken(Users),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
