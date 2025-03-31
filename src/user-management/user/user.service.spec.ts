import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { TenantService } from '../tenant/tenant.service';
import { UserRole } from '../../common/enums/roles';
import { PinoLogger } from 'nestjs-pino';

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<Repository<User>>;
  let roleRepository: jest.Mocked<Repository<Role>>;
  // let logger: PinoLogger;

  const mockRole = {
    id: 1,
    name: UserRole.MEMBER,
  } as Role;

  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    roles: [mockRole],
  } as User;

  const mockUserRepo = {
    create: jest.fn().mockReturnValue(mockUser),
    save: jest.fn().mockResolvedValue(mockUser),
    findOne: jest.fn().mockResolvedValue(mockUser),
    find: jest.fn().mockResolvedValue([mockUser]),
  } as unknown as jest.Mocked<Repository<User>>;

  const mockRoleRepo = {
    findOne: jest.fn().mockResolvedValue(mockRole),
    find: jest.fn().mockResolvedValue([mockRole]),
  } as unknown as jest.Mocked<Repository<Role>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PinoLogger,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            setContext: jest.fn(),
          },
        },
        UserService,
        {
          provide: TenantService,
          useValue: { getTenantId: () => 'tenant123' },
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(getRepositoryToken(User));
    roleRepository = module.get(getRepositoryToken(Role));

    jest.clearAllMocks();
  });

  describe('Webhook Handlers', () => {
    describe('handleUserCreation', () => {
      const mockWebhookData = {
        data: {
          id: 'user123',
          email_addresses: [{ email_address: 'test@example.com' }],
          first_name: 'John',
          last_name: 'Doe',
          tenant_id: 'tenant123',
        },
      };

      it('should create new user from webhook data', async () => {
        mockUserRepo.create.mockReturnValue(mockUser);
        mockUserRepo.save.mockResolvedValue(mockUser);

        const result = await service.handleUserCreation(mockWebhookData as any);

        expect(mockUserRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'user123',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
          }),
        );
        expect(result).toEqual(mockUser);
      });
    });

    describe('handleMembershipCreated', () => {
      const mockMembershipData = {
        data: {
          public_user_data: {
            user_id: 'user123',
            identifier: 'test@example.com',
            first_name: 'John',
            last_name: 'Doe',
          },
          organization: { id: 'org123' },
        },
      };

      it('should update user tenant ID when user exists', async () => {
        const existingUser = { ...mockUser };
        const updatedUser = { ...mockUser, activeTenantId: 'org123' };
        mockUserRepo.findOne.mockResolvedValueOnce(existingUser);
        mockUserRepo.save.mockResolvedValueOnce(updatedUser);

        await service.handleMembershipCreated(mockMembershipData as any);

        expect(mockUserRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            ...existingUser,
            activeTenantId: 'org123',
          }),
        );
      });

      it('should create user with tenant ID when user does not exist', async () => {
        mockUserRepo.findOne.mockResolvedValueOnce(null);

        const newUser = {
          id: 'user123',
          clerkId: 'user123',
          email: 'test@example.com',
          username: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          activeTenantId: 'org123',
        } as User;

        mockUserRepo.create.mockReturnValueOnce(newUser);
        mockUserRepo.save.mockResolvedValueOnce(newUser);

        await service.handleMembershipCreated(mockMembershipData as any);

        expect(mockUserRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'user123',
            clerkId: 'user123',
            email: 'test@example.com',
            username: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            activeTenantId: 'org123',
          }),
        );
        expect(mockUserRepo.save).toHaveBeenCalledWith(newUser);
      });
    });
  });

  describe('syncClerkUser', () => {
    it('should create a new user if not exists', async () => {
      userRepository.findOne.mockResolvedValue(null);
      roleRepository.findOne.mockResolvedValue(mockRole);
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
