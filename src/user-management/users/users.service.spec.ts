import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Role } from '../../entities/roles/role.entity';
import { User } from '../../entities/users/user.entity';
import { UsersService } from './users.service';
import { TenantService } from '../../database/tenant.service';
import { UserRole } from '../../common/enums/roles';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<Repository<User>>;
  let roleRepository: jest.Mocked<Repository<Role>>;

  const mockUser: User = {
    id: 'user123',
    clerkId: 'clerk123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    activeTenantId: 'tenant123',
    roles: [],
    isActive: true,
  } as User;

  const mockRole = {
    id: 1,
    name: UserRole.MEMBER,
  } as Role;

  beforeEach(async () => {
    const mockUserRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const mockRoleRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const mockTenantService = {
      getTenantId: jest.fn().mockReturnValue('tenant123'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: TenantService,
          useValue: mockTenantService,
        },
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
      userRepository.findOne.mockResolvedValueOnce(null);
      roleRepository.findOne.mockResolvedValueOnce(mockRole);
      userRepository.create.mockReturnValueOnce(mockUser);
      userRepository.save.mockResolvedValueOnce(mockUser);

      const result = await service.syncClerkUser('clerk123', 'tenant123', {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(userRepository.findOne).toHaveBeenCalledWith({
        relations: ['roles'],
        where: { clerkId: 'clerk123', activeTenantId: 'tenant123' },
      });
      expect(roleRepository.findOne).toHaveBeenCalledWith({
        where: { name: UserRole.MEMBER },
      });
      expect(result).toEqual(mockUser);
    });

    it('should update existing user if found', async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      const updatedUser = { ...mockUser, email: 'new@example.com' };
      userRepository.save.mockResolvedValueOnce(updatedUser);

      const result = await service.syncClerkUser('clerk123', 'tenant123', {
        email: 'new@example.com',
      });

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
        }),
      );
      expect(result.email).toBe('new@example.com');
    });
  });

  describe('getTenantUsers', () => {
    it('should return Tenant users sorted by name', async () => {
      userRepository.find.mockResolvedValueOnce([mockUser]);

      const result = await service.getTenantUsers('tenant123');

      expect(userRepository.find).toHaveBeenCalledWith({
        where: { activeTenantId: 'tenant123' },
        order: { firstName: 'ASC', lastName: 'ASC' },
      });
      expect(result).toEqual([mockUser]);
    });
  });

  describe('updateUserRole', () => {
    it('should update user roles successfully', async () => {
      const adminRole = { name: UserRole.ADMIN } as Role;
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      roleRepository.find.mockResolvedValueOnce([adminRole]);
      const updatedUser = { ...mockUser, roles: [adminRole] };
      userRepository.save.mockResolvedValueOnce(updatedUser);

      const result = await service.updateUserRole(
        'user123',
        [UserRole.ADMIN],
        'tenant123',
      );

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ roles: [adminRole] }),
      );
      expect(result.roles).toEqual([adminRole]);
    });
  });

  describe('findUser', () => {
    it('should find user by clerkId', async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);

      const result = await service.findUser('clerk123');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        relations: ['roles'],
        where: { clerkId: 'clerk123', activeTenantId: 'tenant123' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      userRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.findUser('nonexistent');

      expect(result).toBeNull();
    });
  });
});
