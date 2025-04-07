import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { UserTenantService } from './user-tenant.service';
import { User } from './entities/user.entity';
import { Tenant } from './entities/tenant.entity';
import { PinoLogger } from 'nestjs-pino';

describe('UserTenantService', () => {
  let service: UserTenantService;

  let queryRunner: jest.Mocked<QueryRunner>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    tenants: [],
    activeTenantId: null,
    roles: [],
    clerkId: 'clerk-1',
    username: 'testuser',
  } as User;

  const mockTenant = {
    id: 'tenant-1',
    name: 'Test Tenant',
    users: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Tenant;

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        save: jest.fn(),
      },
    } as unknown as jest.Mocked<QueryRunner>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserTenantService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
          },
        },
        {
          provide: PinoLogger,
          useValue: {
            setContext: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserTenantService>(UserTenantService);
  });

  describe('executeOperation', () => {
    it('should add user to tenant successfully', async () => {
      const userData = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        clerkId: 'clerk-1',
        username: 'testuser',
      };

      jest
        .spyOn(queryRunner.manager, 'findOne')
        .mockResolvedValueOnce(mockTenant);
      jest
        .spyOn(queryRunner.manager, 'findOne')
        .mockResolvedValueOnce(userData);

      const savedUser = {
        ...userData,
        tenants: [mockTenant],
        activeTenantId: mockTenant.id,
        roles: [],
      } as User;

      jest.spyOn(queryRunner.manager, 'save').mockResolvedValueOnce(savedUser);

      const result = await service.executeOperation({
        userId: userData.id,
        tenantId: mockTenant.id,
        operationType: 'ADD',
        userData,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(queryRunner.manager.findOne).toHaveBeenNthCalledWith(1, Tenant, {
        where: { id: mockTenant.id },
        relations: ['users'],
        lock: { mode: 'pessimistic_write' },
      });
      expect(queryRunner.manager.findOne).toHaveBeenNthCalledWith(2, User, {
        where: { id: userData.id },
        relations: ['tenants', 'roles'],
        lock: { mode: 'pessimistic_write' },
      });
      expect(queryRunner.manager.save).toHaveBeenCalledWith(
        User,
        expect.objectContaining({
          id: userData.id,
          email: userData.email,
          tenants: [expect.objectContaining({ id: mockTenant.id })],
        }),
      );
    });

    it('should update user membership successfully', async () => {
      const existingUser = { ...mockUser, tenants: [mockTenant] };

      jest
        .spyOn(queryRunner.manager, 'findOne')
        .mockResolvedValueOnce(mockTenant);
      jest
        .spyOn(queryRunner.manager, 'findOne')
        .mockResolvedValueOnce(existingUser);

      const result = await service.executeOperation({
        userId: 'user-1',
        tenantId: 'tenant-1',
        operationType: 'UPDATE',
        userData: {
          firstName: 'Updated',
        },
      });

      expect(result.success).toBe(true);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should remove user from tenant successfully', async () => {
      const existingUser = { ...mockUser, tenants: [mockTenant] };

      jest
        .spyOn(queryRunner.manager, 'findOne')
        .mockResolvedValueOnce(mockTenant);
      jest
        .spyOn(queryRunner.manager, 'findOne')
        .mockResolvedValueOnce(existingUser);
      jest.spyOn(queryRunner.manager, 'save').mockResolvedValueOnce({
        ...existingUser,
        tenants: [],
      });

      const result = await service.executeOperation({
        userId: 'user-1',
        tenantId: 'tenant-1',
        operationType: 'REMOVE',
        userData: {},
      });

      expect(result.success).toBe(true);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should handle tenant not found error', async () => {
      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValueOnce(null);

      const result = await service.executeOperation({
        userId: 'user-1',
        tenantId: 'tenant-1',
        operationType: 'ADD',
        userData: {},
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Tenant not found');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should handle transaction errors', async () => {
      jest
        .spyOn(queryRunner, 'startTransaction')
        .mockRejectedValueOnce(new Error('Transaction failed'));

      await expect(
        service.executeOperation({
          userId: 'user-1',
          tenantId: 'tenant-1',
          operationType: 'ADD',
          userData: {},
        }),
      ).rejects.toThrow('Transaction failed');

      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });
  });
});
