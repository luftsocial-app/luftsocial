import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import * as Chance from 'chance';
import { UserController } from './user.controller';
import { UserService } from './user.service';

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

  describe('getTenantUsers', () => {
    it('should return Tenant users', async () => {
      const mockUser = { tenantId: chance.guid() };
      const mockUsers = Array.from({ length: 3 }, () => ({
        id: chance.guid(),
        name: chance.name(),
        email: chance.email(),
        tenantId: mockUser.tenantId,
      }));

      mockUsersService.getTenantUsers.mockResolvedValue(mockUsers);

      const result = await controller.getTenantUsers(mockUser);

      expect(result).toEqual(mockUsers);
      expect(mockUsersService.getTenantUsers).toHaveBeenCalledWith(
        mockUser.tenantId,
      );
    });

    it('should handle errors', async () => {
      const mockUser = { tenantId: chance.guid() };
      mockUsersService.getTenantUsers.mockRejectedValue(
        new Error('Test error'),
      );

      await expect(controller.getTenantUsers(mockUser)).rejects.toThrow(
        HttpException,
      );
    });
  });
});
