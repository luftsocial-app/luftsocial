import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Role } from '../../entities/roles/role.entity';
import { User } from '../../entities/users/user.entity';
import { TenantService } from '../tenant/tenant.service';
import { UserRole } from '../../common/enums/roles';
import { ClerkWebhookService } from './clerk-webhook.service';
import { UserService } from '../user/user.service';

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
        UserService,
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
});

describe('ClerkWebhookService', () => {
  let service: ClerkWebhookService;
  let tenantService: TenantService;
  let usersService: UserService;

  const mockTenantService = {
    handleTenantCreation: jest.fn(),
    handleTenantUpdate: jest.fn(),
    handleTenantDeletion: jest.fn(),
  };

  const mockUsersService = {
    handleUserCreation: jest.fn(),
    handleUserUpdate: jest.fn(),
    handleMembershipCreated: jest.fn(),
    handleMembershipDeleted: jest.fn(),
    handleMembershipUpdated: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClerkWebhookService,
        {
          provide: TenantService,
          useValue: mockTenantService,
        },
        {
          provide: UserService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<ClerkWebhookService>(ClerkWebhookService);
    tenantService = module.get<TenantService>(TenantService);
    usersService = module.get<UserService>(UserService);
  });

  it('should delegate user creation to UserService', async () => {
    const mockWebhookData = { data: { id: 'test-id' } };
    await service.createUser(mockWebhookData as any);
    expect(mockUsersService.handleUserCreation).toHaveBeenCalledWith(
      mockWebhookData,
    );
  });

  it('should delegate tenant creation to TenantService', async () => {
    const mockWebhookData = { data: { id: 'test-id' } };
    await service.tenantCreated(mockWebhookData as any);
    expect(mockTenantService.handleTenantCreation).toHaveBeenCalledWith(
      mockWebhookData,
    );
  });

  it('should delegate membership creation to UserService', async () => {
    const mockWebhookData = { data: { id: 'test-id' } };
    await service.membershipCreated(mockWebhookData as any);
    expect(mockUsersService.handleMembershipCreated).toHaveBeenCalledWith(
      mockWebhookData,
    );
  });
});
