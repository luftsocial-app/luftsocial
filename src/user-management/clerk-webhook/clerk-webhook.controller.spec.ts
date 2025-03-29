import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import * as Chance from 'chance';
import { UserService } from '../user/user.service';
import { UserController } from '../user/user.controller';

const chance = new Chance();

describe('UsersController', () => {
  let controller: UserController;

  const mockUsersService = {
    getUsers: jest.fn(),
    getTenantUsers: jest.fn(),
    updateUserRole: jest.fn(),
    syncClerkUser: jest.fn(),
    findUser: jest.fn(),
    createUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  describe('getTenantUsers', () => {});
});
