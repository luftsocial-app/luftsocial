import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { RoleGuard } from './role-guard';
import { UserService } from '../user-management/user.service';
import { UserRole } from '../common/enums/roles';
import { User } from '../user-management/entities/user.entity';
import { Role } from '../user-management/entities/role.entity';

// DeepMocked type helper (optional, can use 'any' or manual mocks)
type DeepMocked<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? jest.Mock<ReturnType<T[K]>, Parameters<T[K]>>
    : DeepMocked<T[K]>;
} & T;

describe('RoleGuard', () => {
  let guard: RoleGuard;
  let reflectorMock: DeepMocked<Reflector>;
  let userServiceMock: DeepMocked<UserService>;
  let loggerMock: DeepMocked<PinoLogger>;

  // Helper to create a mock ExecutionContext
  const createMockExecutionContext = (
    requiredRoles?: UserRole[] | undefined,
    userId?: string | null,
  ): ExecutionContext => {
    const mockRequest = {
      auth: userId === null ? undefined : userId ? { userId } : {}, // Handles undefined userId, null auth, and present userId
    };

    reflectorMock.getAllAndOverride.mockReturnValue(requiredRoles);

    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    // Manual mocks; for more complex scenarios, NestJS's Test.createTestingModule might be used
    reflectorMock = {
      getAllAndOverride: jest.fn(),
    } as DeepMocked<Reflector>;

    userServiceMock = {
      findUserWithRelations: jest.fn(),
    } as DeepMocked<UserService>;

    loggerMock = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      setContext: jest.fn(), // setContext is called in constructor
    } as DeepMocked<PinoLogger>;

    guard = new RoleGuard(reflectorMock, loggerMock, userServiceMock); // Corrected order as per RoleGuard constructor
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate scenarios', () => {
    it('should return true if no roles are required', async () => {
      const context = createMockExecutionContext(undefined, 'user123'); // No roles required
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(reflectorMock.getAllAndOverride).toHaveBeenCalledWith('roles', [
        expect.any(Function),
        expect.any(Function),
      ]);
    });

    it('should return true if roles array is empty', async () => {
      const context = createMockExecutionContext([], 'user123'); // Empty roles array
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should return true if user has the required role', async () => {
      const requiredRoles = [UserRole.ADMIN];
      const userId = 'adminUser';
      const context = createMockExecutionContext(requiredRoles, userId);
      const mockUserWithRole: Partial<User> = {
        id: userId,
        roles: [{ name: UserRole.ADMIN } as Role],
      };
      userServiceMock.findUserWithRelations.mockResolvedValue(
        mockUserWithRole as User,
      );

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(userServiceMock.findUserWithRelations).toHaveBeenCalledWith(
        userId,
      );
    });

    it('should return false if user does not have the required role', async () => {
      const requiredRoles = [UserRole.ADMIN];
      const userId = 'memberUser';
      const context = createMockExecutionContext(requiredRoles, userId);
      const mockUserWithoutRole: Partial<User> = {
        id: userId,
        roles: [{ name: UserRole.MEMBER } as Role],
      };
      userServiceMock.findUserWithRelations.mockResolvedValue(
        mockUserWithoutRole as User,
      );

      const result = await guard.canActivate(context);
      expect(result).toBe(false);
      expect(userServiceMock.findUserWithRelations).toHaveBeenCalledWith(
        userId,
      );
      expect(loggerMock.info).toHaveBeenCalledWith(
        { userId, userRoles: [UserRole.MEMBER], requiredRoles },
        'User does not have any of the required roles.',
      );
    });

    it('should return true if user has one of multiple required roles', async () => {
      const requiredRoles = [UserRole.ADMIN, UserRole.EDITOR];
      const userId = 'editorUser';
      const context = createMockExecutionContext(requiredRoles, userId);
      const mockUserWithOneRole: Partial<User> = {
        id: userId,
        roles: [{ name: UserRole.EDITOR } as Role],
      };
      userServiceMock.findUserWithRelations.mockResolvedValue(
        mockUserWithOneRole as User,
      );

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should return false if user has no roles', async () => {
      const requiredRoles = [UserRole.ADMIN];
      const userId = 'userWithNoRoles';
      const context = createMockExecutionContext(requiredRoles, userId);
      const mockUserWithNoRoles: Partial<User> = {
        id: userId,
        roles: [], // Empty roles array
      };
      userServiceMock.findUserWithRelations.mockResolvedValue(
        mockUserWithNoRoles as User,
      );

      const result = await guard.canActivate(context);
      expect(result).toBe(false);
      expect(loggerMock.warn).toHaveBeenCalledWith(
        { userId, requiredRoles },
        'User not found by UserService, or has no roles.',
      );
    });

    it('should return false if user roles are null', async () => {
      const requiredRoles = [UserRole.ADMIN];
      const userId = 'userWithNullRoles';
      const context = createMockExecutionContext(requiredRoles, userId);
      const mockUserWithNullRoles: Partial<User> = {
        id: userId,
        roles: null, // Roles property is null
      };
      userServiceMock.findUserWithRelations.mockResolvedValue(
        mockUserWithNullRoles as User,
      );

      const result = await guard.canActivate(context);
      expect(result).toBe(false);
      expect(loggerMock.warn).toHaveBeenCalledWith(
        { userId, requiredRoles },
        'User not found by UserService, or has no roles.',
      );
    });

    it('should return false if request.auth.userId is missing', async () => {
      const requiredRoles = [UserRole.ADMIN];
      const context = createMockExecutionContext(requiredRoles, undefined); // No userId

      const result = await guard.canActivate(context);
      expect(result).toBe(false);
      expect(userServiceMock.findUserWithRelations).not.toHaveBeenCalled();
      expect(loggerMock.warn).toHaveBeenCalledWith(
        'No userId found on request.auth.userId. Ensure ClerkAuthGuard runs before RoleGuard.',
      );
    });

    it('should return false if request.auth is missing', async () => {
      const requiredRoles = [UserRole.ADMIN];
      const context = createMockExecutionContext(requiredRoles, null); // auth object is undefined

      const result = await guard.canActivate(context);
      expect(result).toBe(false);
      expect(userServiceMock.findUserWithRelations).not.toHaveBeenCalled();
      expect(loggerMock.warn).toHaveBeenCalledWith(
        'No userId found on request.auth.userId. Ensure ClerkAuthGuard runs before RoleGuard.',
      );
    });

    it('should return false if userService.findUserWithRelations throws an error', async () => {
      const requiredRoles = [UserRole.ADMIN];
      const userId = 'errorUser';
      const context = createMockExecutionContext(requiredRoles, userId);
      const error = new Error('UserService error');
      userServiceMock.findUserWithRelations.mockRejectedValue(error);

      const result = await guard.canActivate(context);
      expect(result).toBe(false);
      expect(loggerMock.error).toHaveBeenCalledWith(
        { error, userId, requiredRoles },
        'Error in RoleGuard while fetching user or checking roles',
      );
    });

    it('should return false if userService.findUserWithRelations returns null (user not found)', async () => {
      const requiredRoles = [UserRole.ADMIN];
      const userId = 'notFoundUser';
      const context = createMockExecutionContext(requiredRoles, userId);
      userServiceMock.findUserWithRelations.mockResolvedValue(null); // User not found

      const result = await guard.canActivate(context);
      expect(result).toBe(false);
      expect(loggerMock.warn).toHaveBeenCalledWith(
        { userId, requiredRoles },
        'User not found by UserService, or has no roles.',
      );
    });
  });
});
