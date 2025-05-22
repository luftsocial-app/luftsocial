import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRole, Permission } from '../common/enums/roles';
import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { AuthObject } from '@clerk/express';
// Using User from @clerk/backend as it's a more generic type for Clerk user objects.
// @clerk/express also exports User, which might be more specific to request/auth contexts.
// Let's assume userService.findById and getUsers return a type compatible with @clerk/backend's User.
import { User as clerkUser } from '@clerk/backend';
import { User } from './entities/user.entity'; // Local User Entity

// Mock data
const mockClerkUser1: clerkUser = {
  id: 'clerk_user_1',
  firstName: 'Clerk',
  lastName: 'UserOne',
  emailAddresses: [{ emailAddress: 'clerk1@example.com', id: 'email_id_1', linkedTo: [], object: 'email_address', verification: null }],
  primaryEmailAddressId: 'email_id_1',
  username: 'clerkuser1',
  publicMetadata: {},
  privateMetadata: {},
  unsafeMetadata: {},
  createdAt: new Date().valueOf(),
  updatedAt: new Date().valueOf(),
  profileImageUrl: '',
  gender: '',
  birthday: '',
  passwordEnabled: true,
  twoFactorEnabled: false,
  totpEnabled: false,
  backupCodeEnabled: false,
  banned: false,
  deletedAt: null,
  externalAccounts: [],
  externalId: null,
  lastSignInAt: null,
  phoneNumbers: [],
  primaryPhoneNumberId: null,
  primaryWeb3WalletId: null,
  samlAccounts: [],
  web3Wallets: [],
  lastActiveAt: null,
  createOrganizationEnabled: true,
  mfaEnabledAt: null,
  locked: false,
  lockoutExpiresInSeconds: null,
  verificationAttemptsRemaining: 100,
  passkeys: [],
};

const mockClerkUser2: clerkUser = { ...mockClerkUser1, id: 'clerk_user_2', username: 'clerkuser2' };

const mockLocalUser: User = {
  id: 'local_user_1',
  clerkId: 'clerk_user_1',
  email: 'local1@example.com',
  username: 'localuser1',
  firstName: 'Local',
  lastName: 'UserOne',
  isActive: true,
  permissions: [],
  roles: [{ id: 1, name: UserRole.MEMBER, createdAt: new Date(), permissions: [] }],
  createdAt: new Date(),
  updatedAt: new Date(),
  isDeleted: false,
  // other fields...
} as User;

const mockAuthObject: AuthObject = {
  userId: 'user_auth_123',
  sessionId: 'sess_auth_123',
  orgId: 'org_auth_123',
  actor: null,
  claims: { org_role: UserRole.ADMIN, org_slug: 'my-org' }, // Example claims
  getToken: jest.fn().mockResolvedValue('mock_token'),
  has: jest.fn().mockReturnValue(true),
  debug: jest.fn(),
};


describe('UserController', () => {
  let controller: UserController;
  let userServiceMock: jest.Mocked<UserService>;

  beforeEach(async () => {
    const userServiceMockValue = {
      getUsers: jest.fn(),
      getTenantUsers: jest.fn(),
      updateUserRole: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: userServiceMockValue },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userServiceMock = module.get(UserService) as jest.Mocked<UserService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUsers', () => {
    it('should return an array of clerk users', async () => {
      const clerkUsersArray = [mockClerkUser1, mockClerkUser2];
      userServiceMock.getUsers.mockResolvedValue(clerkUsersArray);

      const result = await controller.getUsers();
      expect(result).toEqual(clerkUsersArray);
      expect(userServiceMock.getUsers).toHaveBeenCalled();
    });

    it('should return an empty array if no users exist', async () => {
      userServiceMock.getUsers.mockResolvedValue([]);
      const result = await controller.getUsers();
      expect(result).toEqual([]);
      expect(userServiceMock.getUsers).toHaveBeenCalled();
    });
  });

  describe('getTenantUsers', () => {
    it('should return an array of local User entity-like objects for a tenant', async () => {
      const localUsersArray = [mockLocalUser, { ...mockLocalUser, id: 'local_user_2' }];
      userServiceMock.getTenantUsers.mockResolvedValue(localUsersArray);

      const result = await controller.getTenantUsers(mockAuthObject);
      expect(result).toEqual(localUsersArray);
      expect(userServiceMock.getTenantUsers).toHaveBeenCalledWith(mockAuthObject.orgId);
    });
    
    it('should throw HttpException if service fails', async () => {
        userServiceMock.getTenantUsers.mockRejectedValue(new Error("Service failure"));
        await expect(controller.getTenantUsers(mockAuthObject)).rejects.toThrow(
            new HttpException("Service failure", HttpStatus.INTERNAL_SERVER_ERROR),
        );
    });
  });

  describe('updateUserRole', () => {
    const updateUserRoleBody = {
      userId: 'user_to_update_id',
      roles: [UserRole.ADMIN, UserRole.MANAGER],
      permissions: [Permission.MANAGE_USERS], // Permissions part of body but not used by service directly
    };

    it('should update user role and return the updated local User', async () => {
      const updatedLocalUser = { ...mockLocalUser, roles: [{name: UserRole.ADMIN} as Role, {name: UserRole.MANAGER} as Role] };
      userServiceMock.updateUserRole.mockResolvedValue(updatedLocalUser);

      const result = await controller.updateUserRole(updateUserRoleBody, mockAuthObject);
      expect(result).toEqual(updatedLocalUser);
      expect(userServiceMock.updateUserRole).toHaveBeenCalledWith(
        updateUserRoleBody.userId,
        updateUserRoleBody.roles,
        mockAuthObject.orgId,
      );
    });

    it('should throw HttpException with BAD_REQUEST if service throws BadRequestException', async () => {
      const errorMessage = 'Invalid roles provided';
      userServiceMock.updateUserRole.mockRejectedValue(new BadRequestException(errorMessage));

      await expect(controller.updateUserRole(updateUserRoleBody, mockAuthObject)).rejects.toThrow(
        new HttpException(errorMessage, HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw HttpException with INTERNAL_SERVER_ERROR for other service errors', async () => {
      const errorMessage = 'Some internal service error';
      userServiceMock.updateUserRole.mockRejectedValue(new Error(errorMessage));

      await expect(controller.updateUserRole(updateUserRoleBody, mockAuthObject)).rejects.toThrow(
        new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR),
      );
    });
  });

  describe('findUser', () => {
    const clerkIdToFind = 'clerk_id_to_find';

    it('should return a clerkUser when found', async () => {
      userServiceMock.findById.mockResolvedValue(mockClerkUser1);
      const result = await controller.findUser(clerkIdToFind);
      expect(result).toEqual(mockClerkUser1);
      expect(userServiceMock.findById).toHaveBeenCalledWith(clerkIdToFind);
    });

    it('should throw HttpException with NOT_FOUND if service indicates user not found (status 404)', async () => {
      const notFoundError = { status: 404, message: 'Clerk user not found' };
      userServiceMock.findById.mockRejectedValue(notFoundError);

      await expect(controller.findUser(clerkIdToFind)).rejects.toThrow(
        new HttpException('User not found', HttpStatus.NOT_FOUND),
      );
    });
    
    it('should throw HttpException with NOT_FOUND if service indicates user not found (resource_not_found code)', async () => {
        const notFoundError = { errors: [{ code: 'resource_not_found' }], message: 'Clerk user not found' };
        userServiceMock.findById.mockRejectedValue(notFoundError);
  
        await expect(controller.findUser(clerkIdToFind)).rejects.toThrow(
          new HttpException('User not found', HttpStatus.NOT_FOUND),
        );
      });

    it('should throw HttpException with INTERNAL_SERVER_ERROR for other service errors', async () => {
      const genericErrorMessage = 'Some other service error';
      userServiceMock.findById.mockRejectedValue(new Error(genericErrorMessage));

      await expect(controller.findUser(clerkIdToFind)).rejects.toThrow(
        new HttpException(genericErrorMessage, HttpStatus.INTERNAL_SERVER_ERROR),
      );
    });
  });
});
