import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from '../../user-management/user.controller';
import { UserService } from '../../user-management/user.service';

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

  describe('getTenantUsers', () => {
    it('should be defined', async () => {
      expect(controller).toBeDefined();
    });
  });
});
