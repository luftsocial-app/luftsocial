import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as Chance from 'chance';
import { DataSource, Repository } from 'typeorm';

import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';
import { UserRole } from '../types/enums';
import { TenantAwareRepository } from '../database/tenant-aware.repository';
import { UsersService } from './users.service';

const chance = new Chance();

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<Repository<User>>;
  let roleRepository: jest.Mocked<Repository<Role>>;
  let mockTenantAwareRepo: jest.Mocked<Partial<TenantAwareRepository<User>>>;

  const mockUser: User = {
    id: 'user123',
    clerkId: 'clerk123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    organizationId: 'tenant123',
    roles: [],
  } as User;

  const mockRole = {
    id: 1,
    name: UserRole.MEMBER,
  } as Role;

  beforeEach(async () => {
    mockTenantAwareRepo = {
      setTenantId: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createTenantQueryBuilder: jest.fn(),
    };

    const mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockTenantAwareRepo),
    } as unknown as jest.Mocked<DataSource>;

    const mockUserRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      manager: {
        connection: mockDataSource,
      },
    } as unknown as jest.Mocked<Repository<User>>;

    const mockRoleRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<Role>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepo,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get(getRepositoryToken(User));
    roleRepository = module.get(getRepositoryToken(Role));
  });

  describe('syncClerkUser', () => {
    it('should create a new user if not exists', async () => {
      mockTenantAwareRepo.findOne.mockResolvedValueOnce(null);
      roleRepository.findOne.mockResolvedValueOnce(mockRole);
      userRepository.create.mockReturnValueOnce(mockUser);
      userRepository.save.mockResolvedValueOnce(mockUser);

      const result = await service.syncClerkUser('clerk123', 'tenant123', {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      // expect(mockTenantAwareRepo.setTenantId).toHaveBeenCalledWith('tenant123');
      expect(roleRepository.findOne).toHaveBeenCalledWith({
        where: { name: UserRole.MEMBER },
      });
      expect(userRepository.create).toHaveBeenCalled();
      expect(userRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should update existing user if found', async () => {
      mockTenantAwareRepo.findOne.mockResolvedValueOnce(mockUser);
      userRepository.save.mockResolvedValueOnce({
        ...mockUser,
        email: 'new@example.com',
      });

      const result = await service.syncClerkUser('clerk123', 'tenant123', {
        email: 'new@example.com',
      });

      // expect(mockTenantAwareRepo.setTenantId).toHaveBeenCalledWith('tenant123');
      expect(userRepository.save).toHaveBeenCalled();
      expect(result.email).toBe('new@example.com');
    });

    it('should throw error if default role not found', async () => {
      mockTenantAwareRepo.findOne.mockResolvedValueOnce(null);
      roleRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.syncClerkUser('clerk123', 'tenant123', {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getOrganizationUsers', () => {
    it('should return organization users sorted by name', async () => {
      const mockUsers = [mockUser];
      mockTenantAwareRepo.find.mockResolvedValueOnce(mockUsers);

      const result = await service.getOrganizationUsers('tenant123');

      // expect(mockTenantAwareRepo.setTenantId).toHaveBeenCalledWith('tenant123');
      expect(mockTenantAwareRepo.find).toHaveBeenCalledWith({
        where: { organizationId: 'tenant123' },
        order: { firstName: 'ASC', lastName: 'ASC' },
      });
      expect(result).toEqual(mockUsers);
    });

    it('should handle errors appropriately', async () => {
      mockTenantAwareRepo.find.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.getOrganizationUsers('tenant123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateUserRole', () => {
    it('should update user roles successfully', async () => {
      const roles = [UserRole.ADMIN];
      mockTenantAwareRepo.findOne.mockResolvedValueOnce(mockUser);
      roleRepository.find.mockResolvedValueOnce([
        { name: UserRole.ADMIN },
      ] as Role[]);
      userRepository.save.mockResolvedValueOnce({
        ...mockUser,
        roles: [
          {
            name: UserRole.ADMIN,
            createdAt: chance.date(),
            id: chance.integer(),
            permissions: [],
            users: [],
          },
        ],
      });

      const result = await service.updateUserRole(
        'user123',
        roles,
        'tenant123',
      );

      // expect(mockTenantAwareRepo.setTenantId).toHaveBeenCalledWith('tenant123');
      expect(roleRepository.find).toHaveBeenCalled();
      expect(userRepository.save).toHaveBeenCalled();
      expect(result.roles).toHaveLength(1);
    });

    it('should throw error if user not found', async () => {
      mockTenantAwareRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.updateUserRole('user123', [UserRole.ADMIN], 'tenant123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findUser', () => {
    it('should find user by clerkId and tenantId', async () => {
      mockTenantAwareRepo.findOne.mockResolvedValueOnce(mockUser);

      const result = await service.findUser('clerk123', 'tenant123');

      // expect(mockTenantAwareRepo.setTenantId).toHaveBeenCalledWith('tenant123');
      expect(mockTenantAwareRepo.findOne).toHaveBeenCalledWith({
        where: { clerkId: 'clerk123', organizationId: 'tenant123' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should handle errors appropriately', async () => {
      mockTenantAwareRepo.findOne.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.findUser('clerk123', 'tenant123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
