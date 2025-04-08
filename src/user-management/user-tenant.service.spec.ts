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
  let userRepository: jest.Mocked<Repository<User>>;

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
        create: jest.fn(),
        query: jest.fn(),
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
    userRepository = module.get(getRepositoryToken(User));
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

      // Mock finding tenant but no existing user
      jest
        .spyOn(queryRunner.manager, 'findOne')
        .mockResolvedValueOnce(mockTenant); // First call for tenant

      jest
        .spyOn(queryRunner.manager, 'findOne')
        .mockResolvedValueOnce(mockUser); // Second call for user (not found)

      const savedUser = {
        ...userData,
        tenants: [mockTenant],
        activeTenantId: mockTenant.id,
        roles: [],
      } as User;

      // Mock the user creation and save
      jest.spyOn(userRepository, 'create').mockReturnValue(savedUser);
      jest.spyOn(queryRunner.manager, 'save').mockResolvedValueOnce(savedUser);

      // Mock the query for user-tenant relationship
      jest
        .spyOn(queryRunner.manager, 'query')
        .mockResolvedValueOnce({ affected: 1 });

      const result = await service.executeOperation({
        userId: userData.id,
        tenantId: mockTenant.id,
        operationType: 'ADD',
        userData,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(savedUser);

      // Verify the sequence of operations
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.manager.findOne).toHaveBeenCalledTimes(2);
      expect(queryRunner.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tbl_user_tenants'),
        [userData.id, mockTenant.id],
      );
      expect(queryRunner.manager.save).toHaveBeenCalledWith(User, savedUser);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should update user membership successfully', async () => {
      const existingUser = { ...mockUser, tenants: [mockTenant] };

      jest
        .spyOn(queryRunner.manager, 'findOne')
        .mockResolvedValueOnce(mockTenant);
      jest
        .spyOn(queryRunner.manager, 'findOne')
        .mockResolvedValueOnce(mockUser);

      jest
        .spyOn(queryRunner.manager, 'save')
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

    it('should handle user not found error', async () => {
      jest
        .spyOn(queryRunner.manager, 'findOne')
        .mockResolvedValueOnce(mockTenant)
        .mockResolvedValueOnce(null);

      const result = await service.executeOperation({
        userId: 'non-existent-user',
        tenantId: mockTenant.id,
        operationType: 'UPDATE',
        userData: {},
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('User not found');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should handle invalid operation type', async () => {
      jest
        .spyOn(queryRunner.manager, 'findOne')
        .mockResolvedValueOnce(mockTenant)
        .mockResolvedValueOnce(mockUser);

      jest.spyOn((service as any).logger, 'error');

      const result = await service.executeOperation({
        userId: mockUser.id,
        tenantId: mockTenant.id,
        operationType: 'INVALID' as any,
        userData: {},
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid operation type');
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

    it('should properly clean up resources on success', async () => {
      jest
        .spyOn(queryRunner.manager, 'findOne')
        .mockResolvedValueOnce(mockTenant)
        .mockResolvedValueOnce(mockUser); // existing user

      jest
        .spyOn(queryRunner.manager, 'query')
        .mockResolvedValueOnce({ affected: 1 }); // simulate relationship insert

      jest.spyOn(queryRunner.manager, 'save').mockResolvedValueOnce(mockUser);

      const result = await service.executeOperation({
        userId: mockUser.id,
        tenantId: mockTenant.id,
        operationType: 'ADD',
        userData: {},
      });

      expect(result.success).toBe(true);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe('transaction handling', () => {
    it('should rollback and release on error', async () => {
      jest
        .spyOn(queryRunner.manager, 'findOne')
        .mockRejectedValueOnce(new Error('Database error'));

      await expect(
        service.executeOperation({
          userId: mockUser.id,
          tenantId: mockTenant.id,
          operationType: 'ADD',
          userData: {},
        }),
      ).resolves.toEqual({
        error: expect.any(Error),
        message: 'Database error',
        success: false,
      });

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });
});
