import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { UserRole } from '../common/enums/roles';
import { PinoLogger } from 'nestjs-pino';
import { Tenant } from './entities/tenant.entity';
import { TenantService } from './tenant.service';
import { UserWebhookEvent } from '@clerk/express'; // Import UserWebhookEvent
import { BadRequestException, NotFoundException } from '@nestjs/common';


// Mock PinoLogger
const mockPinoLogger = {
  setContext: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<Repository<User>>;
  let roleRepository: jest.Mocked<Repository<Role>>;
  let tenantRepository: jest.Mocked<Repository<Tenant>>; // Added TenantRepository mock

  const mockUserClerkId = 'user_clerk123';
  const mockTenantId = 'tenant-uuid-1';
  const mockOtherTenantId = 'tenant-uuid-2';

  const mockMemberRole = { id: 1, name: UserRole.MEMBER } as Role;
  const mockAdminRole = { id: 2, name: UserRole.ADMIN } as Role;

  let mockUserEntity: User;

  beforeEach(async () => {
    // Reset mockUserEntity before each test to avoid test interference
    mockUserEntity = {
      id: mockUserClerkId, // Assuming User.id is the Clerk ID
      clerkId: mockUserClerkId,
      email: 'test@example.com',
      username: 'testuser',
      firstName: 'John',
      lastName: 'Doe',
      activeTenantId: mockTenantId,
      roles: [mockMemberRole],
      tenants: [{ id: mockTenantId } as Tenant, { id: mockOtherTenantId } as Tenant], // User belongs to two tenants
    } as User;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PinoLogger, useValue: mockPinoLogger },
        { provide: TenantService, useValue: { /* mock TenantService methods if directly used */ } },
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Role),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Tenant), // Provide TenantRepository
          useValue: {
            findOneBy: jest.fn(), // Mock findOneBy if used by syncClerkUser
          },
        },
        {
          provide: 'CLERK_CLIENT', // Keep CLERK_CLIENT if other methods use it directly
          useValue: {
            users: { getUserList: jest.fn().mockResolvedValue({ data: [mockUserEntity] }) },
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(getRepositoryToken(User));
    roleRepository = module.get(getRepositoryToken(Role));
    tenantRepository = module.get(getRepositoryToken(Tenant)); // Get TenantRepository

    jest.clearAllMocks();
  });

  describe('createUser', () => {
    const mockUserCreatedEvent = {
      data: {
        id: 'newUserClerkId',
        email_addresses: [{ id: 'ead1', email_address: 'newuser@example.com' }],
        primary_email_address_id: 'ead1',
        first_name: 'New',
        last_name: 'User',
        username: 'newbie',
      },
      type: 'user.created',
    } as UserWebhookEvent;

    it('should create a user with activeTenantId if provided', async () => {
      const newTenantId = 'new-personal-tenant-id';
      const expectedUserObject = {
        id: mockUserCreatedEvent.data.id,
        clerkId: mockUserCreatedEvent.data.id,
        email: 'newuser@example.com',
        username: 'newbie',
        firstName: 'New',
        lastName: 'User',
        activeTenantId: newTenantId,
      };
      userRepository.create.mockReturnValue(expectedUserObject as User);
      userRepository.save.mockResolvedValue(expectedUserObject as User);

      const result = await service.createUser(mockUserCreatedEvent, newTenantId);

      expect(userRepository.create).toHaveBeenCalledWith(expectedUserObject);
      expect(userRepository.save).toHaveBeenCalledWith(expectedUserObject as User);
      expect(result.activeTenantId).toBe(newTenantId);
    });

    it('should create a user with activeTenantId as null if not provided', async () => {
      const expectedUserObject = {
        id: mockUserCreatedEvent.data.id,
        clerkId: mockUserCreatedEvent.data.id,
        email: 'newuser@example.com',
        username: 'newbie',
        firstName: 'New',
        lastName: 'User',
        activeTenantId: null,
      };
      userRepository.create.mockReturnValue(expectedUserObject as User);
      userRepository.save.mockResolvedValue(expectedUserObject as User);
      
      const result = await service.createUser(mockUserCreatedEvent);
      
      expect(userRepository.create).toHaveBeenCalledWith(expectedUserObject);
      expect(userRepository.save).toHaveBeenCalledWith(expectedUserObject as User);
      expect(result.activeTenantId).toBeNull();
    });

    it('should throw BadRequestException if primary email is missing', async () => {
        const eventWithoutEmail = { ...mockUserCreatedEvent, data: { ...mockUserCreatedEvent.data, email_addresses: [], primary_email_address_id: null }};
        await expect(service.createUser(eventWithoutEmail)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateUserRole', () => {
    it('should update user roles successfully for a user in the specified tenant', async () => {
      userRepository.findOne.mockResolvedValue(mockUserEntity); // User found with activeTenantId = mockTenantId
      roleRepository.find.mockResolvedValue([mockAdminRole]);
      
      const expectedSavedUser = { ...mockUserEntity, roles: [mockAdminRole] };
      userRepository.save.mockResolvedValue(expectedSavedUser);

      const result = await service.updateUserRole(mockUserClerkId, [UserRole.ADMIN], mockTenantId);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserClerkId, activeTenantId: mockTenantId },
        relations: ['roles'],
      });
      expect(roleRepository.find).toHaveBeenCalledWith({
        where: [{ name: UserRole.ADMIN }],
      });
      expect(userRepository.save).toHaveBeenCalledWith(expect.objectContaining({ roles: [mockAdminRole] }));
      expect(result.roles).toEqual([mockAdminRole]);
    });

    it('should throw BadRequestException if user not found in tenant', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.updateUserRole(mockUserClerkId, [UserRole.ADMIN], mockTenantId)).rejects.toThrow(BadRequestException);
    });
    
    it('should throw BadRequestException if one or more roles not found', async () => {
        userRepository.findOne.mockResolvedValue(mockUserEntity);
        roleRepository.find.mockResolvedValue([]); // No roles found
        await expect(service.updateUserRole(mockUserClerkId, [UserRole.ADMIN], mockTenantId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById (previously findUser)', () => {
    it('should find user by clerkId and scope to tenantId if user is in tenant', async () => {
      userRepository.findOne.mockResolvedValue(mockUserEntity); // mockUserEntity.tenants includes mockTenantId
      const result = await service.findById(mockUserClerkId, mockTenantId);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { clerkId: mockUserClerkId },
        relations: ['roles', 'tenants'],
      });
      expect(result).toEqual(mockUserEntity);
    });

    it('should return null if user found by clerkId but not in specified tenantIdToScope', async () => {
      userRepository.findOne.mockResolvedValue(mockUserEntity);
      const result = await service.findById(mockUserClerkId, 'non-member-tenant-id');
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { clerkId: mockUserClerkId },
        relations: ['roles', 'tenants'],
      });
      expect(result).toBeNull();
    });

    it('should find user by clerkId without tenant scope if tenantIdToScope is not provided', async () => {
      userRepository.findOne.mockResolvedValue(mockUserEntity);
      const result = await service.findById(mockUserClerkId);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { clerkId: mockUserClerkId },
        relations: ['roles', 'tenants'],
      });
      expect(result).toEqual(mockUserEntity);
    });

    it('should return null if user not found by clerkId', async () => {
      userRepository.findOne.mockResolvedValue(null);
      const result = await service.findById('nonexistent-clerk-id');
      expect(result).toBeNull();
    });
  });
  
  describe('syncClerkUser', () => {
    const syncClerkId = 'syncUserClerk123';
    const syncTenantId = 'syncTenant123';
    const syncUserData = { email: 'sync@example.com', firstName: 'Sync', lastName: 'User' };
    let mockSyncedUser: User;
    let mockTenantForSync: Tenant;

    beforeEach(() => {
        mockSyncedUser = {
            id: syncClerkId,
            clerkId: syncClerkId,
            ...syncUserData,
            activeTenantId: syncTenantId,
            tenants: [],
            roles: [mockMemberRole],
        } as User;
        mockTenantForSync = { id: syncTenantId, name: 'Sync Tenant' } as Tenant;
        
        roleRepository.findOne.mockResolvedValue(mockMemberRole); // Default role
        tenantRepository.findOneBy.mockResolvedValue(mockTenantForSync);
    });

    it('should update user if found in tenant (via findById(clerkId, tenantId))', async () => {
        userRepository.findOne.mockResolvedValueOnce(mockSyncedUser); // Simulates findById(clerkId, tenantId) finding the user
        userRepository.save.mockResolvedValue({ ...mockSyncedUser, firstName: "UpdatedSync" });

        const result = await service.syncClerkUser(syncClerkId, syncTenantId, { firstName: "UpdatedSync" });
        
        expect(userRepository.findOne).toHaveBeenCalledWith({ where: { clerkId: syncClerkId }, relations: ['roles', 'tenants'] }); // from findById(clerkId, tenantId)
        expect(userRepository.save).toHaveBeenCalledWith(expect.objectContaining({ firstName: "UpdatedSync" }));
        expect(result.firstName).toBe("UpdatedSync");
    });

    it('should add user to tenant if user exists globally but not in tenant', async () => {
        // findById(clerkId, tenantId) returns null
        userRepository.findOne.mockResolvedValueOnce(null); 
        // findById(clerkId) returns global user
        const globalUser = { ...mockSyncedUser, tenants: [] }; // No tenants initially for this global user mock
        userRepository.findOne.mockResolvedValueOnce(globalUser); 
        userRepository.save.mockImplementation(async (user) => user as User);


        const result = await service.syncClerkUser(syncClerkId, syncTenantId, syncUserData);

        expect(userRepository.findOne).toHaveBeenNthCalledWith(1, { where: { clerkId: syncClerkId }, relations: ['roles', 'tenants'] }); // For findById(clerkId, tenantId)
        expect(userRepository.findOne).toHaveBeenNthCalledWith(2, { where: { clerkId: syncClerkId }, relations: ['roles', 'tenants'] }); // For findById(clerkId)
        expect(tenantRepository.findOneBy).toHaveBeenCalledWith({ id: syncTenantId });
        expect(result.tenants).toContainEqual(mockTenantForSync);
        // if activeTenantId was null on globalUser, it should be set
        if(!globalUser.activeTenantId) expect(result.activeTenantId).toBe(syncTenantId); 
        expect(userRepository.save).toHaveBeenCalled();
    });
    
    it('should create new user if not found globally and add to tenant', async () => {
        userRepository.findOne.mockResolvedValue(null); // Both findById calls return null
        userRepository.create.mockReturnValue(mockSyncedUser); // User object to be created
        userRepository.save.mockResolvedValue(mockSyncedUser);


        const result = await service.syncClerkUser(syncClerkId, syncTenantId, syncUserData);

        expect(userRepository.findOne).toHaveBeenCalledTimes(2); // for findById(clerkId, tenantId) and findById(clerkId)
        expect(userRepository.create).toHaveBeenCalledWith(expect.objectContaining({
            id: syncClerkId,
            clerkId: syncClerkId,
            email: syncUserData.email,
            activeTenantId: syncTenantId,
        }));
        expect(tenantRepository.findOneBy).toHaveBeenCalledWith({ id: syncTenantId });
        expect(result.tenants).toContainEqual(mockTenantForSync);
        expect(userRepository.save).toHaveBeenCalledWith(mockSyncedUser);
    });
  });

  // Placeholder for other tests like getTenantUsers, deleteUser etc.
  // These would need their mocks (userRepository.find, userRepository.remove) to be set up similarly.
});
