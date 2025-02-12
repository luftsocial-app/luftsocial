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
    getOrganizationUsers: jest.fn(),
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

  describe('getOrganizationUsers', () => {
    it('should return organization users', async () => {
      const mockUser = { organizationId: chance.guid() };
      const mockUsers = Array.from({ length: 3 }, () => ({
        id: chance.guid(),
        name: chance.name(),
        email: chance.email(),
        organizationId: mockUser.organizationId,
      }));

      mockUsersService.getOrganizationUsers.mockResolvedValue(mockUsers);

      const result = await controller.getOrganizationUsers(mockUser);

      expect(result).toEqual(mockUsers);
      expect(mockUsersService.getOrganizationUsers).toHaveBeenCalledWith(
        mockUser.organizationId,
      );
    });

    it('should handle errors', async () => {
      const mockUser = { organizationId: chance.guid() };
      mockUsersService.getOrganizationUsers.mockRejectedValue(
        new Error('Test error'),
      );

      await expect(controller.getOrganizationUsers(mockUser)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('syncUser', () => {
    it('should sync clerk user', async () => {
      const clerkId = chance.guid();
      const currentUser = {
        organizationId: chance.guid(),
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
        currentUser.organizationId,
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
