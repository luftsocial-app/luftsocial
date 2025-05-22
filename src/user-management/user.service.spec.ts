import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { User } from './entities/user.entity'; // Local User entity
import { Role } from './entities/role.entity';
import { Tenant } from './entities/tenant.entity'; // Local Tenant entity
import { UserRole } from '../common/enums/roles';
import { PinoLogger } from 'nestjs-pino';
import { TenantService } from './tenant.service';
import { InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { User as ClerkUserType } from '@clerk/backend'; // For mocking Clerk user
import { OrganizationMembership } from '@clerk/backend'; // For mocking memberships


// --- Mock Data Definitions ---
const mockAdminRole = { id: 'role_admin', name: UserRole.ADMIN } as Role;
const mockMemberRole = { id: 'role_member', name: UserRole.MEMBER } as Role;

const mockLocalUser = (id: string, roles: Role[], tenants?: Tenant[]): User => ({
  id,
  clerkId: id,
  email: `${id}@example.com`,
  firstName: 'Test',
  lastName: 'User',
  username: `${id}@example.com`,
  activeTenantId: tenants?.[0]?.id || 'tenant_default_123',
  roles: roles,
  tenants: tenants || [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

const mockClerkUser = (id: string): ClerkUserType => ({
  id,
  firstName: 'Clerk',
  lastName: 'User',
  emailAddresses: [{ emailAddress: `${id}@clerk.example.com`, id: 'eal_123', linkedTo: [], verification: { status: 'verified', strategy: 'email_code', attempts: 0, expireAt: 0 }}],
  phoneNumbers: [],
  web3Wallets: [],
  externalAccounts: [],
  username: `${id}_clerk`,
  passwordEnabled: false,
  totpEnabled: false,
  backupCodeEnabled: false,
  twoFactorEnabled: false,
  banned: false,
  createdAt: new Date().getTime(),
  updatedAt: new Date().getTime(),
  profileImageUrl: '',
  imageUrl: '',
  hasImage: false,
  publicMetadata: {},
  privateMetadata: {},
  unsafeMetadata: {},
  lastSignInAt: null,
  externalId: null,
  lastActiveAt: null,
  createOrganizationEnabled:true,
  samlAccounts: [],
});

const mockOrgMembership = (userId: string, orgId: string, role: string = 'basic_member'): OrganizationMembership => ({
  id: `omm_${userId}_${orgId}`,
  organization: { id: orgId, name: `${orgId}_name`, slug: orgId, imageUrl: '', hasImage: false, publicMetadata: {}, privateMetadata:{}, createdAt: new Date().getTime(), updatedAt: new Date().getTime(), membersCount:1, adminDeleteEnabled: true, maxAllowedMemberships: 0 },
  publicUserData: { userId, firstName: 'Test', lastName: 'User', profileImageUrl:'', imageUrl: '', identifier: `${userId}@example.com`, hasImage: false },
  role,
  createdAt: new Date().getTime(),
  updatedAt: new Date().getTime(),
  permissions:[],
  publicMetadata:{}
});


describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<Repository<User>>;
  let roleRepository: jest.Mocked<Repository<Role>>;
  // let tenantRepository: jest.Mocked<Repository<Tenant>>; // Keep if direct tenant repo interaction is tested, otherwise remove
  let mockClerkClient;

  // Default mock implementations for Clerk client methods
  const mockGetUser = jest.fn();
  const mockGetOrganizationMembershipList = jest.fn();
  const mockGetUserList = jest.fn();


  beforeEach(async () => {
    // Reset mocks for each test
    mockGetUser.mockReset();
    mockGetOrganizationMembershipList.mockReset();
    mockGetUserList.mockReset();

    mockClerkClient = {
      users: {
        getUser: mockGetUser,
        getUserList: mockGetUserList,
      },
      organizations: {
        getOrganizationMembershipList: mockGetOrganizationMembershipList,
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PinoLogger,
          useValue: { // Basic mock for PinoLogger
            info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), setContext: jest.fn(),
          },
        },
        {
          provide: TenantService, // Mock TenantService if its methods are called
          useValue: { getTenantId: jest.fn().mockReturnValue('tenant_default_123') },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { // Mock TypeORM repository methods for User
            create: jest.fn(), save: jest.fn(), findOne: jest.fn(), find: jest.fn(), remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Role),
          useValue: { // Mock TypeORM repository methods for Role
            findOne: jest.fn(), find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Tenant), // Mock for Tenant, even if not heavily used directly by UserService
          useValue: { findOne: jest.fn(), find: jest.fn() },
        },
        {
          provide: 'CLERK_CLIENT', // Provide the mock Clerk client
          useValue: mockClerkClient,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(getRepositoryToken(User));
    roleRepository = module.get(getRepositoryToken(Role));
    // tenantRepository = module.get(getRepositoryToken(Tenant));

    jest.clearAllMocks(); // Also clear Jest's internal mock state
  });

  // Placeholder for initial describe block to ensure file structure is valid
  describe('Initial Placeholder Test', () => {
    it('should be true', () => {
      expect(true).toBe(true);
    });
  });

  // Webhook Handlers will be refactored below
  describe('Webhook Handlers', () => {
    // Tests for createUser, updateUser, deleteUser will be refactored here
    // Example for createUser (to be expanded as per instructions)
    describe('createUser', () => {
      const mockWebhookEvent = {
        data: {
          id: 'new_user_clerk_id',
          email_addresses: [{ email_address: 'new_user@example.com', id:'eal_new', linkedTo:[], verification: {status:'verified', strategy:'email_code', attempts:1, expireAt:0} }],
          first_name: 'New',
          last_name: 'User',
          // No tenant_id here as per new logic
        },
        type: 'user.created'
      } as any; // Cast to any to simplify mock, ensure it matches UserWebhookEvent structure

      it('should create a new user if not found', async () => {
        userRepository.findOne.mockResolvedValue(null); // User does not exist
        const createdLocalUser = mockLocalUser(mockWebhookEvent.data.id, []);
        userRepository.create.mockReturnValue(createdLocalUser);
        userRepository.save.mockResolvedValue(createdLocalUser);

        const result = await service.createUser(mockWebhookEvent);

        expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: mockWebhookEvent.data.id } });
        expect(userRepository.create).toHaveBeenCalledWith(expect.objectContaining({
          id: mockWebhookEvent.data.id,
          clerkId: mockWebhookEvent.data.id,
          email: 'new_user@example.com',
          firstName: 'New',
          lastName: 'User',
          // Importantly, activeTenantId should NOT be set from webhook data
        }));
        expect(userRepository.save).toHaveBeenCalledWith(createdLocalUser);
        expect(result).toEqual(createdLocalUser);
      });

      it('should return existing user if found and not create new one', async () => {
        const existingLocalUser = mockLocalUser(mockWebhookEvent.data.id, [mockMemberRole]);
        userRepository.findOne.mockResolvedValue(existingLocalUser); // User already exists

        const result = await service.createUser(mockWebhookEvent);

        expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: mockWebhookEvent.data.id } });
        expect(userRepository.create).not.toHaveBeenCalled();
        expect(userRepository.save).not.toHaveBeenCalled();
        expect(result).toEqual(existingLocalUser);
      });
    });
  });


  // Old tests for syncClerkUser, getTenantUsers, updateUserRole, findUser
  // will be refactored or replaced below with new describe blocks
  // for getClerkUserWithLocalRolesById, getClerkUserWithLocalRelationsById, etc.

  describe('getClerkUserWithLocalRolesById', () => {
    const userId = 'user_clerk_123';
    const clerkUserInstance = mockClerkUser(userId);

    it('should return user with local roles if found in Clerk and locally', async () => {
      const localUserInstance = mockLocalUser(userId, [mockAdminRole]);
      mockGetUser.mockResolvedValue(clerkUserInstance);
      userRepository.findOne.mockResolvedValue(localUserInstance);

      const result = await service.getClerkUserWithLocalRolesById(userId);

      expect(mockGetUser).toHaveBeenCalledWith(userId);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
        relations: ['roles'],
      });
      expect(result).toEqual({
        ...clerkUserInstance,
        localRoles: localUserInstance.roles,
      });
    });

    it('should return user with empty local roles if local user or roles not found', async () => {
      mockGetUser.mockResolvedValue(clerkUserInstance);
      userRepository.findOne.mockResolvedValue(null); // No local user

      const result = await service.getClerkUserWithLocalRolesById(userId);

      expect(mockGetUser).toHaveBeenCalledWith(userId);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
        relations: ['roles'],
      });
      expect(result).toEqual({
        ...clerkUserInstance,
        localRoles: [],
      });
    });

    it('should return user with empty local roles if local user has no roles', async () => {
      const localUserNoRoles = mockLocalUser(userId, []);
      mockGetUser.mockResolvedValue(clerkUserInstance);
      userRepository.findOne.mockResolvedValue(localUserNoRoles);

      const result = await service.getClerkUserWithLocalRolesById(userId);
      expect(result).toEqual({
        ...clerkUserInstance,
        localRoles: [],
      });
    });

    it('should return null if user not found in Clerk', async () => {
      // Simulate Clerk 404 error
      const clerkNotFoundError = { status: 404, errors: [{ code: 'resource_not_found' }] } as any;
      mockGetUser.mockRejectedValue(clerkNotFoundError);

      const result = await service.getClerkUserWithLocalRolesById(userId);

      expect(mockGetUser).toHaveBeenCalledWith(userId);
      expect(userRepository.findOne).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should throw InternalServerErrorException if Clerk client throws an unexpected error', async () => {
      const unexpectedError = new Error('Clerk SDK broke');
      mockGetUser.mockRejectedValue(unexpectedError);

      await expect(service.getClerkUserWithLocalRolesById(userId)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockGetUser).toHaveBeenCalledWith(userId);
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('getClerkUserWithLocalRelationsById', () => {
    const userId = 'user_clerk_456';
    const clerkUserInstance = mockClerkUser(userId);
    const mockTenant = { id: 'tenant_1', name: 'Tenant One' } as Tenant;

    it('should return user with local roles and tenants if found', async () => {
      const localUserInstance = mockLocalUser(userId, [mockMemberRole], [mockTenant]);
      mockGetUser.mockResolvedValue(clerkUserInstance);
      userRepository.findOne.mockResolvedValue(localUserInstance);

      const result = await service.getClerkUserWithLocalRelationsById(userId);

      expect(mockGetUser).toHaveBeenCalledWith(userId);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
        relations: ['roles', 'tenants'],
      });
      expect(result).toEqual({
        ...clerkUserInstance,
        localRoles: localUserInstance.roles,
        localTenants: localUserInstance.tenants,
      });
    });

    it('should return user with empty local relations if local user not found', async () => {
      mockGetUser.mockResolvedValue(clerkUserInstance);
      userRepository.findOne.mockResolvedValue(null); // No local user

      const result = await service.getClerkUserWithLocalRelationsById(userId);

      expect(mockGetUser).toHaveBeenCalledWith(userId);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
        relations: ['roles', 'tenants'],
      });
      expect(result).toEqual({
        ...clerkUserInstance,
        localRoles: [],
        localTenants: [],
      });
    });

     it('should return user with empty local relations if local user has no roles/tenants', async () => {
      const localUserNoRelations = mockLocalUser(userId, [], []);
      mockGetUser.mockResolvedValue(clerkUserInstance);
      userRepository.findOne.mockResolvedValue(localUserNoRelations);

      const result = await service.getClerkUserWithLocalRelationsById(userId);
      expect(result).toEqual({
        ...clerkUserInstance,
        localRoles: [],
        localTenants: [],
      });
    });

    it('should return null if user not found in Clerk', async () => {
      const clerkNotFoundError = { status: 404, errors: [{ code: 'resource_not_found' }] } as any;
      mockGetUser.mockRejectedValue(clerkNotFoundError);

      const result = await service.getClerkUserWithLocalRelationsById(userId);

      expect(mockGetUser).toHaveBeenCalledWith(userId);
      expect(userRepository.findOne).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should throw InternalServerErrorException on unexpected Clerk error', async () => {
      const unexpectedError = new Error('Clerk SDK broke again');
      mockGetUser.mockRejectedValue(unexpectedError);

      await expect(service.getClerkUserWithLocalRelationsById(userId)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockGetUser).toHaveBeenCalledWith(userId);
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('getTenantUsers', () => {
    const tenantId = 'org_tenant_123';
    const user1Id = 'user_clerk_tenant_1';
    const user2Id = 'user_clerk_tenant_2';

    const clerkUser1 = mockClerkUser(user1Id);
    const clerkUser2 = mockClerkUser(user2Id);

    const membership1 = mockOrgMembership(user1Id, tenantId);
    const membership2 = mockOrgMembership(user2Id, tenantId);


    it('should return users if memberships and users are found in Clerk', async () => {
      mockGetOrganizationMembershipList.mockResolvedValue({ data: [membership1, membership2], total_count: 2 });
      mockGetUserList.mockResolvedValue({ data: [clerkUser1, clerkUser2], total_count: 2 });

      const result = await service.getTenantUsers(tenantId);

      expect(mockGetOrganizationMembershipList).toHaveBeenCalledWith({
        organizationId: tenantId,
        limit: 200,
      });
      expect(mockGetUserList).toHaveBeenCalledWith({
        userId: [user1Id, user2Id],
        limit: 2,
      });
      expect(result).toEqual([clerkUser1, clerkUser2]);
    });

    it('should return empty array if no memberships are found', async () => {
      mockGetOrganizationMembershipList.mockResolvedValue({ data: [], total_count: 0 });

      const result = await service.getTenantUsers(tenantId);

      expect(mockGetOrganizationMembershipList).toHaveBeenCalledWith({
        organizationId: tenantId,
        limit: 200,
      });
      expect(mockGetUserList).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should return empty array if memberships are found but no user IDs (publicUserData.userId is null)', async () => {
      const membershipNoUserId = { ...membership1, publicUserData: { ...membership1.publicUserData, userId: null } };
      mockGetOrganizationMembershipList.mockResolvedValue({ data: [membershipNoUserId], total_count: 1 });

      const result = await service.getTenantUsers(tenantId);
      expect(mockGetOrganizationMembershipList).toHaveBeenCalledWith({ organizationId: tenantId, limit: 200 });
      expect(mockGetUserList).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
    
    it('should return empty array if memberships are found, user IDs exist, but Clerk getUserList returns empty', async () => {
      mockGetOrganizationMembershipList.mockResolvedValue({ data: [membership1], total_count: 1 });
      mockGetUserList.mockResolvedValue({ data: [], total_count: 0 }); // No users found for the IDs

      const result = await service.getTenantUsers(tenantId);
      expect(mockGetUserList).toHaveBeenCalledWith({ userId: [user1Id], limit: 1 });
      expect(result).toEqual([]);
    });

    it('should throw InternalServerErrorException if getOrganizationMembershipList fails', async () => {
      const error = new Error('Clerk org fetch failed');
      mockGetOrganizationMembershipList.mockRejectedValue(error);

      await expect(service.getTenantUsers(tenantId)).rejects.toThrow(InternalServerErrorException);
      expect(mockGetUserList).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException if getUserList fails', async () => {
      mockGetOrganizationMembershipList.mockResolvedValue({ data: [membership1], total_count: 1 });
      const error = new Error('Clerk user list fetch failed');
      mockGetUserList.mockRejectedValue(error);

      await expect(service.getTenantUsers(tenantId)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('updateUserRole', () => {
    const userId = 'user_clerk_update_role_123';
    const clerkUserInstance = mockClerkUser(userId);

    it('should successfully update user roles and return UserWithLocalRoles DTO', async () => {
      const localUserInstance = mockLocalUser(userId, [mockMemberRole]); // Start with member role
      mockGetUser.mockResolvedValue(clerkUserInstance);
      userRepository.findOne.mockResolvedValue(localUserInstance);
      roleRepository.find.mockResolvedValue([mockAdminRole]); // Target role is admin
      userRepository.save.mockResolvedValue({ ...localUserInstance, roles: [mockAdminRole] });

      const result = await service.updateUserRole(userId, [UserRole.ADMIN]);

      expect(mockGetUser).toHaveBeenCalledWith(userId);
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: userId }, relations: ['roles'] });
      expect(roleRepository.find).toHaveBeenCalledWith({ where: [{ name: UserRole.ADMIN }] });
      expect(userRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: userId, roles: [mockAdminRole] }));
      expect(result).toEqual({
        ...clerkUserInstance,
        localRoles: [mockAdminRole],
      });
    });

    it('should throw NotFoundException if user not found in Clerk', async () => {
      const clerkNotFoundError = { status: 404, errors: [{ code: 'resource_not_found' }] } as any;
      mockGetUser.mockRejectedValue(clerkNotFoundError);

      await expect(service.updateUserRole(userId, [UserRole.ADMIN])).rejects.toThrow(
        new NotFoundException(`User with ID ${userId} not found in Clerk.`),
      );
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException if Clerk getUser fails unexpectedly', async () => {
      const clerkError = new Error('Clerk network error');
      mockGetUser.mockRejectedValue(clerkError);

      await expect(service.updateUserRole(userId, [UserRole.ADMIN])).rejects.toThrow(
        InternalServerErrorException,
      );
    });
    
    it('should throw NotFoundException if local user record not found', async () => {
      mockGetUser.mockResolvedValue(clerkUserInstance);
      userRepository.findOne.mockResolvedValue(null); // No local user

      await expect(service.updateUserRole(userId, [UserRole.ADMIN])).rejects.toThrow(
        new NotFoundException(`Local user record for ID ${userId} not found. Cannot update roles.`),
      );
      expect(roleRepository.find).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if one or more role names are invalid', async () => {
      const localUserInstance = mockLocalUser(userId, [mockMemberRole]);
      mockGetUser.mockResolvedValue(clerkUserInstance);
      userRepository.findOne.mockResolvedValue(localUserInstance);
      // Simulate finding only one of the requested roles
      roleRepository.find.mockResolvedValue([mockAdminRole]); 

      await expect(service.updateUserRole(userId, [UserRole.ADMIN, 'InvalidRoleName' as UserRole])).rejects.toThrow(
        new BadRequestException(`The following roles were not found: InvalidRoleName`),
      );
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  // describe('Webhook Handlers', () => { // This was the old top-level wrapper
    // The 'createUser' tests were already partially updated in turn 26.
    // Consolidating and ensuring all conditions for createUser are met.
    describe('createUser (Webhook)', () => { // Renaming for clarity
      const clerkUserId = 'clerk_user_on_create_hook';
      const mockUserCreatedEvent = {
        data: {
          id: clerkUserId,
          email_addresses: [{ email_address: `${clerkUserId}@example.com`, id:'eal_create', linkedTo:[], verification: {status:'verified', strategy:'email_code', attempts:0, expireAt:0} }],
          first_name: 'Webhook',
          last_name: 'Created',
          // Deliberately no tenant_id here to test it's not used
        },
        type: 'user.created'
      } as any;

      it('should create a new user if not found locally', async () => {
        userRepository.findOne.mockResolvedValue(null); // User does not exist
        const newUserFromWebhook = mockLocalUser(clerkUserId, []);
        // Ensure the create mock doesn't include activeTenantId from webhook
        userRepository.create.mockImplementation(dto => ({ ...newUserFromWebhook, ...dto, id: clerkUserId, clerkId: clerkUserId }));
        userRepository.save.mockResolvedValue(newUserFromWebhook);

        const result = await service.createUser(mockUserCreatedEvent);

        expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: clerkUserId } });
        expect(userRepository.create).toHaveBeenCalledWith(expect.objectContaining({
          id: clerkUserId,
          email: `${clerkUserId}@example.com`,
          firstName: 'Webhook',
          lastName: 'Created',
        }));
        // Crucially check that activeTenantId was not part of the create DTO from webhook data
        const createCallArg = userRepository.create.mock.calls[0][0];
        expect(createCallArg.activeTenantId).toBeUndefined();
        expect(userRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: clerkUserId }));
        expect(result).toEqual(newUserFromWebhook);
      });

      it('should return existing user if found locally and not call create/save', async () => {
        const existingLocalUser = mockLocalUser(clerkUserId, [mockMemberRole]);
        userRepository.findOne.mockResolvedValue(existingLocalUser);

        const result = await service.createUser(mockUserCreatedEvent);

        expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: clerkUserId } });
        expect(userRepository.create).not.toHaveBeenCalled();
        expect(userRepository.save).not.toHaveBeenCalled();
        expect(result).toEqual(existingLocalUser);
        // Verify logger was called with info about skipping creation
        expect(service['logger'].info).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('User already exists. Skipping creation'));
      });
    });

    describe('updateUser (Webhook)', () => {
      const clerkUserId = 'clerk_user_on_update_hook';
      const mockUserUpdatedEvent = {
        data: {
          id: clerkUserId,
          email_addresses: [{ email_address: `updated_${clerkUserId}@example.com`, id:'eal_update', linkedTo:[], verification: {status:'verified', strategy:'email_code', attempts:0, expireAt:0} }],
          first_name: 'WebhookUpdated',
          last_name: 'UserUpdated',
          // No tenant_id
        },
        type: 'user.updated'
      } as any;

      it('should update an existing user if found locally', async () => {
        const existingLocalUser = mockLocalUser(clerkUserId, [mockMemberRole]);
        userRepository.findOne.mockResolvedValue(existingLocalUser);
        const updatedUser = { ...existingLocalUser, firstName: 'WebhookUpdated' };
        userRepository.save.mockResolvedValue(updatedUser);

        const result = await service.updateUser(mockUserUpdatedEvent);

        expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: clerkUserId } });
        expect(userRepository.create).not.toHaveBeenCalled(); // Should not create
        expect(userRepository.save).toHaveBeenCalledWith(expect.objectContaining({
          id: clerkUserId,
          firstName: 'WebhookUpdated',
          lastName: 'UserUpdated',
          email: `updated_${clerkUserId}@example.com`,
        }));
        expect(result).toEqual(updatedUser);
      });

      it('should create a new user if not found locally (upsert logic)', async () => {
        userRepository.findOne.mockResolvedValue(null); // User does not exist
        const newUserFromUpdateWebhook = mockLocalUser(clerkUserId, []);
         userRepository.create.mockImplementation(dto => ({ ...newUserFromUpdateWebhook, ...dto, id: clerkUserId, clerkId: clerkUserId }));
        userRepository.save.mockResolvedValue(newUserFromUpdateWebhook);

        const result = await service.updateUser(mockUserUpdatedEvent);

        expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: clerkUserId } });
        expect(userRepository.create).toHaveBeenCalledWith(expect.objectContaining({
          id: clerkUserId,
          email: `updated_${clerkUserId}@example.com`,
          firstName: 'WebhookUpdated',
          lastName: 'UserUpdated',
        }));
        // Check activeTenantId was not part of create DTO
        const createCallArg = userRepository.create.mock.calls[0][0];
        expect(createCallArg.activeTenantId).toBeUndefined();
        expect(userRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: clerkUserId }));
        expect(result).toEqual(newUserFromUpdateWebhook);
      });
    });

    describe('deleteUser (Webhook)', () => {
      const clerkUserId = 'clerk_user_on_delete_hook';
      const mockUserDeletedEvent = {
        data: { id: clerkUserId, deleted: true }, // Corrected: 'delete' to 'deleted'
        type: 'user.deleted'
      } as any;


      it('should delete user if found locally', async () => {
        const existingLocalUser = mockLocalUser(clerkUserId, [mockMemberRole]);
        userRepository.findOne.mockResolvedValue(existingLocalUser);
        userRepository.remove.mockResolvedValue(undefined); // .remove usually doesn't return the entity

        await service.deleteUser(mockUserDeletedEvent);

        expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: clerkUserId } });
        expect(userRepository.remove).toHaveBeenCalledWith(existingLocalUser);
      });

      it('should log and return gracefully if user not found locally', async () => {
        userRepository.findOne.mockResolvedValue(null); // User does not exist

        await service.deleteUser(mockUserDeletedEvent);

        expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: clerkUserId } });
        expect(userRepository.remove).not.toHaveBeenCalled();
        // Verify logger was called with warning
        expect(service['logger'].warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('User not found. Skipping deletion.'));
      });
    });
  // }); // End of old top-level Webhook Handlers describe

  describe('syncClerkUser', () => {
    const clerkId = 'clerk_sync_123';
    const tenantId = 'tenant_sync_456'; // Still needed for creating user with activeTenantId
    const syncUserData = {
      email: 'sync@example.com',
      firstName: 'Synced',
      lastName: 'User',
    };

    it('should create a new user if not found locally (with activeTenantId and default role)', async () => {
      userRepository.findOne.mockResolvedValue(null); // User does not exist locally
      roleRepository.findOne.mockResolvedValue(mockMemberRole); // Default role
      const createdUser = mockLocalUser(clerkId, [mockMemberRole]);
      // Mock create and save for the new user
      userRepository.create.mockImplementation(dto => ({ ...createdUser, ...dto, id: clerkId, clerkId, activeTenantId: tenantId }));
      userRepository.save.mockResolvedValue(createdUser);


      const result = await service.syncClerkUser(clerkId, tenantId, syncUserData);

      // Verify the findOne call is for the global user ID, without tenant context in the where clause for the initial find
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: clerkId }, // NO tenantId filter here for the initial check
        relations: ['roles'],
      });
      expect(roleRepository.findOne).toHaveBeenCalledWith({ where: { name: UserRole.MEMBER } });
      expect(userRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        clerkId,
        email: syncUserData.email,
        firstName: syncUserData.firstName,
        lastName: syncUserData.lastName,
        activeTenantId: tenantId, // This is set during creation
        roles: [mockMemberRole],
      }));
      expect(userRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: clerkId }));
      expect(result).toEqual(createdUser);
    });

    it('should update an existing user if found locally', async () => {
      const existingUser = mockLocalUser(clerkId, [mockMemberRole]);
      userRepository.findOne.mockResolvedValue(existingUser); // User exists
      const updatedUserData = { ...existingUser, email: 'updated_sync@example.com' };
      userRepository.save.mockResolvedValue(updatedUserData);

      const result = await service.syncClerkUser(clerkId, tenantId, { email: 'updated_sync@example.com' });
      
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: clerkId }, // NO tenantId filter here
        relations: ['roles'],
      });
      expect(userRepository.create).not.toHaveBeenCalled();
      expect(userRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        id: clerkId,
        email: 'updated_sync@example.com',
      }));
      expect(result).toEqual(updatedUserData);
    });

    it('should throw BadRequestException if default role not found when creating user', async () => {
      userRepository.findOne.mockResolvedValue(null); // User does not exist
      roleRepository.findOne.mockResolvedValue(null); // Default role not found!

      await expect(service.syncClerkUser(clerkId, tenantId, syncUserData)).rejects.toThrow(
        BadRequestException,
      );
      expect(roleRepository.findOne).toHaveBeenCalledWith({ where: { name: UserRole.MEMBER } });
    });
  });
});
