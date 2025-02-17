import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { HttpException } from '@nestjs/common';
import * as Chance from 'chance';

const chance = new Chance();

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    getUsers: jest.fn(),
    getTenantUsers: jest.fn(),
    updateUserRole: jest.fn(),
    syncClerkUser: jest.fn(),
    findUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
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

  describe('syncUser', () => {
    it('should sync clerk user', async () => {
      const clerkId = chance.guid();
      const currentUser = {
        tenantId: chance.guid(),
        email: chance.email(),
        firstName: chance.first(),
        lastName: chance.last(),
      };

      const mockSyncedUser = {
        id: chance.guid(),
        clerkId,
        ...currentUser,
      };

      mockUsersService.syncClerkUser.mockResolvedValue(mockSyncedUser);

      const result = await controller.syncUser(clerkId, currentUser);

      expect(result).toEqual(mockSyncedUser);
      expect(mockUsersService.syncClerkUser).toHaveBeenCalledWith(
        clerkId,
        currentUser.tenantId,
        currentUser,
      );
    });

    it('should throw error when clerkId is missing', async () => {
      await expect(controller.syncUser(null, {})).rejects.toThrow(
        'ClerkId is required',
      );
    });
  });
});
