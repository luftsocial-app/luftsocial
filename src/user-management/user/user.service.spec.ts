import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Role } from '../../entities/roles/role.entity';
import { User } from '../../entities/users/user.entity';
import { UserService } from './user.service';
import { TenantService } from '../tenant/tenant.service';
import { UserRole } from '../../common/enums/roles';

describe('UsersService', () => {
  let service: UserService;
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

  const mockUserRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockRoleRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockTenantService = {
    getTenantId: jest.fn().mockReturnValue('tenant123'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: TenantService,
          useValue: mockTenantService,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
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

  describe('handleUserCreation', () => {
    it('should create a new user from webhook data', async () => {
      const mockWebhookData = {
        data: {
          id: 'test-id',
          email_addresses: [{ email_address: 'test@example.com' }],
          first_name: 'John',
          last_name: 'Doe',
          tenant_id: 'tenant-id',
        },
      };

      const expectedUser = {
        id: 'test-id',
        clerkId: 'test-id',
        email: 'test@example.com',
        username: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        activeTenantId: 'tenant-id',
      };

      mockUserRepository.create.mockReturnValue(expectedUser);
      mockUserRepository.save.mockResolvedValue(expectedUser);

      const result = await service.handleUserCreation(mockWebhookData as any);
      expect(result).toEqual(expectedUser);
    });
  });

  describe('handleMembershipCreated', () => {
    it('should update user tenant id when membership is created', async () => {
      const mockMembershipData = {
        data: {
          public_user_data: { user_id: 'user-id' },
          organization: { id: 'org-id' },
        },
      };

      const mockUser = { id: 'user-id', activeTenantId: null };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        activeTenantId: 'org-id',
      });

      await service.handleMembershipCreated(mockMembershipData as any);
      expect(mockUserRepository.save).toHaveBeenCalledWith({
        ...mockUser,
        activeTenantId: 'org-id',
      });
    });

    it('should throw error if user not found', async () => {
      const mockMembershipData = {
        data: {
          public_user_data: { user_id: 'non-existent' },
          organization: { id: 'org-id' },
        },
      };

      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.handleMembershipCreated(mockMembershipData as any),
      ).rejects.toThrow('User not found');
    });
  });
});
