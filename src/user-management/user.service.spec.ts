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
import { CLERK_CLIENT } from '../clerk/clerk.provider'; // Import CLERK_CLIENT token
import { ClerkClient, User as ClerkUserType } from '@clerk/backend'; // For types
import { BadRequestException, NotFoundException } from '@nestjs/common';

// Mock Clerk User
const mockClerkUser = {
  id: 'clerkUser123',
  firstName: 'Clerk',
  lastName: 'User',
  emailAddresses: [{ id: 'email_id_1', emailAddress: 'clerk@example.com' }],
  primaryEmailAddressId: 'email_id_1',
  username: 'clerkusername',
  imageUrl: 'clerk_image_url',
  publicMetadata: { activeTenantId: 'tenant123' },
  createdAt: new Date().valueOf(), // Clerk typically returns numbers for timestamps
  updatedAt: new Date().valueOf(),
} as unknown as ClerkUserType; // Using unknown for flexibility with partial mocks

// Mock Role Entity
const mockRoleEntity = {
  id: 1,
  name: UserRole.MEMBER,
} as Role;

// Mock Local User Entity
const mockLocalUserEntity = {
  id: 'clerkUser123', // Should match Clerk user ID
  clerkId: 'clerkUser123',
  email: 'clerk@example.com',
  firstName: 'Clerk',
  lastName: 'User',
  roles: [mockRoleEntity],
  tenants: [],
  activeTenantId: 'tenant123',
  // other fields from User entity
} as User;


describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<Repository<User>>;
  let roleRepository: jest.Mocked<Repository<Role>>;
  // No tenantRepository directly used by UserService methods being refactored, but keep if other tests use it.
  // let tenantRepository: jest.Mocked<Repository<Tenant>>;
  let mockClerkClient: jest.Mocked<ClerkClient>;

  const mockUserRepoMethods = {
    create: jest.fn().mockReturnValue(mockLocalUserEntity),
    save: jest.fn().mockResolvedValue(mockLocalUserEntity),
    findOne: jest.fn().mockResolvedValue(mockLocalUserEntity),
    find: jest.fn().mockResolvedValue([mockLocalUserEntity]),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  const mockRoleRepoMethods = {
    findOne: jest.fn().mockResolvedValue(mockRoleEntity),
    find: jest.fn().mockResolvedValue([mockRoleEntity]),
  };
  
  // Define the comprehensive ClerkClient mock
  const clerkClientMockFactory = (): jest.Mocked<ClerkClient> => ({
    users: {
      getUser: jest.fn().mockResolvedValue(mockClerkUser),
      getUserList: jest.fn().mockResolvedValue({ data: [mockClerkUser], totalCount: 1 }),
      getOrganizationMembershipList: jest.fn().mockResolvedValue({ data: [], totalCount: 0 }),
      // Add other user methods if needed by other tests (e.g. createUser, updateUser, deleteUser from Clerk)
    },
    organizations: {
      getOrganizationMembershipList: jest.fn().mockResolvedValue({ data: [], totalCount: 0 }),
      // Add other org methods if needed
    },
    // Add other top-level ClerkClient methods if needed
  } as unknown as jest.Mocked<ClerkClient>);


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
        UserService,
        {
          provide: PinoLogger,
          useValue: { // Basic mock for PinoLogger
            info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), setContext: jest.fn(),
          useValue: { // Basic mock for PinoLogger
            info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), setContext: jest.fn(),
          },
        },
        {
          provide: TenantService, // Mock TenantService if its methods are called by UserService
          useValue: { getTenantId: jest.fn().mockReturnValue('tenant123') }, // Example mock
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepoMethods },
        { provide: getRepositoryToken(Role), useValue: mockRoleRepoMethods },
        { provide: getRepositoryToken(Tenant), useValue: {} }, // Empty mock for Tenant if not heavily used
        {
          provide: CLERK_CLIENT, // Use the imported token
          useFactory: clerkClientMockFactory, // Use the factory for the mock
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(getRepositoryToken(User));
    roleRepository = module.get(getRepositoryToken(Role));
    // tenantRepository = module.get(getRepositoryToken(Tenant));
    mockClerkClient = module.get(CLERK_CLIENT);

    jest.clearAllMocks();
  });

  describe('Webhook Handlers', () => {
    describe('createUser', () => { // Assuming 'handleUserCreation' was a typo for 'createUser'
      const mockWebhookData = {
        data: {
          id: 'user123',
          email_addresses: [{ email_address: 'test@example.com' }],
          first_name: 'John',
          last_name: 'Doe',
          // tenant_id: 'tenant123', // tenant_id is not directly used by createUser in the provided service
        },
      } as any; // Using 'any' for brevity, ideally type this properly

      it('should create new user from webhook data', async () => {
        // Ensure mocks are reset or specific for this test if needed
        userRepository.create.mockReturnValueOnce(mockLocalUserEntity); // Assume create returns a User entity instance
        userRepository.save.mockResolvedValueOnce(mockLocalUserEntity);   // Assume save resolves with the saved User entity

        const result = await service.createUser(mockWebhookData);
        
        expect(userRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'user123',
            clerkId: 'user123',
            email: 'test@example.com',
            username: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            // activeTenantId is also part of the object created in service
          }),
        );
        expect(userRepository.save).toHaveBeenCalledWith(mockLocalUserEntity);
        expect(result).toEqual(mockLocalUserEntity);
      });
    });

    // Add similar tests for updateUser and deleteUser if they exist and are webhook handlers
    // These tests should primarily verify interactions with userRepository (create, save, findOne, remove)
  });

  describe('syncClerkUser', () => {
    const clerkId = 'clerkUserToSync123';
    const tenantId = 'tenantForSync123';
    const userData = {
      email: 'sync@example.com',
      firstName: 'Sync',
      lastName: 'User',
    };

    it('should create a new user if not exists in local DB', async () => {
      userRepository.findOne.mockResolvedValue(null); // Simulate user not found locally
      roleRepository.findOne.mockResolvedValue(mockRoleEntity); // Default role
      
      const createdUserEntity = { ...mockLocalUserEntity, id: clerkId, clerkId, ...userData, roles: [mockRoleEntity] };
      userRepository.create.mockReturnValueOnce(createdUserEntity);
      userRepository.save.mockResolvedValueOnce(createdUserEntity);

      const result = await service.syncClerkUser(clerkId, tenantId, userData);

      expect(userRepository.findOne).toHaveBeenCalledWith({ // Original findById logic used by syncClerkUser
        where: { id: clerkId, tenants: { id: tenantId } }, // This where clause was from the old findById
        relations: ['roles'],
      });
      expect(roleRepository.findOne).toHaveBeenCalledWith({ where: { name: UserRole.MEMBER } });
      expect(userRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        clerkId,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        activeTenantId: tenantId,
        roles: [mockRoleEntity],
      }));
      expect(userRepository.save).toHaveBeenCalledWith(createdUserEntity);
      expect(result).toEqual(createdUserEntity);
    });

    it('should update existing user if found in local DB', async () => {
      const existingUser = { ...mockLocalUserEntity, id: clerkId, clerkId };
      userRepository.findOne.mockResolvedValue(existingUser); // Simulate user found locally
      
      const updatedUserData = { email: 'updatedsync@example.com' };
      const expectedSavedUser = { ...existingUser, ...updatedUserData };
      userRepository.save.mockResolvedValueOnce(expectedSavedUser);

      const result = await service.syncClerkUser(clerkId, tenantId, updatedUserData);
      
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: clerkId, tenants: { id: tenantId } },
        relations: ['roles'],
      });
      expect(userRepository.save).toHaveBeenCalledWith(expect.objectContaining(updatedUserData));
      expect(result.email).toBe(updatedUserData.email);
    });

    it('should throw BadRequestException if default role not found during creation', async () => {
        userRepository.findOne.mockResolvedValue(null);
        roleRepository.findOne.mockResolvedValue(null); // Simulate default role not found
  
        await expect(service.syncClerkUser(clerkId, tenantId, userData))
          .rejects.toThrow(BadRequestException);
        expect(roleRepository.findOne).toHaveBeenCalledWith({ where: { name: UserRole.MEMBER } });
      });
  });

  // describe('updateUserRole', () => { ... }); // To be refactored next
  // describe('findById', () => { ... }); // To be refactored (was 'findUser')

  describe('getTenantUsers', () => {
    const tenantId = 'org_tenant123';
    const mockOrgMembership = (userId: string, userFirstName: string, userLastName: string, userImageUrl: string, userIdentifier?: string) => ({
      id: `mem_${userId}`,
      organization: { id: tenantId },
      publicUserData: { // This is OrganizationMembershipPublicUserData
        userId: userId,
        firstName: userFirstName,
        lastName: userLastName,
        identifier: userIdentifier || `${userFirstName.toLowerCase()}@clerktest.com`, // identifier is often email
        imageUrl: userImageUrl,
      },
      createdAt: new Date().valueOf(),
      updatedAt: new Date().valueOf(),
      role: 'org:member', // Example role
    });

    const mockClerkUser1 = {
        ...mockClerkUser, // Base mock
        id: 'user_1_in_tenant',
        firstName: 'Alice',
        lastName: 'Smith',
        username: 'alicesmith',
        emailAddresses: [{id: 'email_1', emailAddress: 'alice@example.com'}],
        primaryEmailAddressId: 'email_1',
        imageUrl: 'alice.png',
      } as unknown as ClerkUserType;
      
    const mockClerkUser2 = {
        ...mockClerkUser,
        id: 'user_2_in_tenant',
        firstName: 'Bob',
        lastName: 'Johnson',
        username: 'bobjohnson',
        emailAddresses: [{id: 'email_2', emailAddress: 'bob@example.com'}],
        primaryEmailAddressId: 'email_2',
        imageUrl: 'bob.png',
    } as unknown as ClerkUserType;

    const membership1 = mockOrgMembership(mockClerkUser1.id, mockClerkUser1.firstName, mockClerkUser1.lastName, mockClerkUser1.imageUrl, mockClerkUser1.emailAddresses[0].emailAddress);
    const membership2 = mockOrgMembership(mockClerkUser2.id, mockClerkUser2.firstName, mockClerkUser2.lastName, mockClerkUser2.imageUrl, mockClerkUser2.emailAddresses[0].emailAddress);


    const localUser1WithRoles = { ...mockLocalUserEntity, id: mockClerkUser1.id, roles: [mockRoleEntity], firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com', profilePicture: 'alice.png' };
    const localUser2WithRoles = { ...mockLocalUserEntity, id: mockClerkUser2.id, roles: [], firstName: 'Bob', lastName: 'Johnson', email: 'bob@example.com', profilePicture: 'bob.png' }; // User 2 has no local roles for testing

    it('should return users from tenant with their local roles', async () => {
      mockClerkClient.organizations.getOrganizationMembershipList.mockResolvedValue({ data: [membership1, membership2], totalCount: 2 });
      
      // Mock individual Clerk user fetches (for email, username etc. not on publicUserData)
      mockClerkClient.users.getUser.mockImplementation(async ({ userId }) => {
        if (userId === mockClerkUser1.id) return mockClerkUser1;
        if (userId === mockClerkUser2.id) return mockClerkUser2;
        return null; // Should not happen in this test
      });

      // Mock local user fetches for roles
      userRepository.findOne.mockImplementation(async (options: any) => {
        if (options.where.id === mockClerkUser1.id) return localUser1WithRoles;
        if (options.where.id === mockClerkUser2.id) return localUser2WithRoles; // Bob might have a local record but no specific roles
        return null;
      });
      
      const result = await service.getTenantUsers(tenantId);

      expect(mockClerkClient.organizations.getOrganizationMembershipList).toHaveBeenCalledWith({ organizationId: tenantId });
      expect(mockClerkClient.users.getUser).toHaveBeenCalledWith({ userId: mockClerkUser1.id });
      expect(mockClerkClient.users.getUser).toHaveBeenCalledWith({ userId: mockClerkUser2.id });
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: mockClerkUser1.id }, relations: ['roles'] });
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: mockClerkUser2.id }, relations: ['roles'] });
      
      expect(result.length).toBe(2);
      
      const user1Result = result.find(u => u.id === mockClerkUser1.id);
      expect(user1Result.firstName).toBe(membership1.publicUserData.firstName);
      expect(user1Result.email).toBe(mockClerkUser1.emailAddresses[0].emailAddress);
      expect(user1Result.username).toBe(mockClerkUser1.username);
      expect(user1Result.roles).toEqual(localUser1WithRoles.roles);
      expect(user1Result.profilePicture).toBe(membership1.publicUserData.imageUrl);

      const user2Result = result.find(u => u.id === mockClerkUser2.id);
      expect(user2Result.firstName).toBe(membership2.publicUserData.firstName);
      expect(user2Result.email).toBe(mockClerkUser2.emailAddresses[0].emailAddress);
      expect(user2Result.username).toBe(mockClerkUser2.username);
      expect(user2Result.roles).toEqual(localUser2WithRoles.roles); // Empty roles for Bob
      expect(user2Result.profilePicture).toBe(membership2.publicUserData.imageUrl);
      
      // Check sorting (Alice Smith then Bob Johnson)
      expect(result[0].id).toBe(mockClerkUser1.id);
      expect(result[1].id).toBe(mockClerkUser2.id);
    });

    it('should return empty array if no memberships found', async () => {
      mockClerkClient.organizations.getOrganizationMembershipList.mockResolvedValue({ data: [], totalCount: 0 });
      const result = await service.getTenantUsers(tenantId);
      expect(result).toEqual([]);
      expect(userRepository.findOne).not.toHaveBeenCalled();
      expect(mockClerkClient.users.getUser).not.toHaveBeenCalled();
    });
    
    it('should handle missing publicUserData in membership gracefully', async () => {
        const membershipWithoutPublicData = { ...membership1, publicUserData: undefined };
        mockClerkClient.organizations.getOrganizationMembershipList.mockResolvedValue({ data: [membershipWithoutPublicData as any], totalCount: 1 });
  
        const result = await service.getTenantUsers(tenantId);
        expect(result.length).toBe(0); // Skips user if publicUserData is missing
      });

    it('should proceed with empty roles if local user record for roles not found', async () => {
        mockClerkClient.organizations.getOrganizationMembershipList.mockResolvedValue({ data: [membership1], totalCount: 1 });
        mockClerkClient.users.getUser.mockResolvedValue(mockClerkUser1);
        userRepository.findOne.mockResolvedValue(null); // No local record for roles
  
        const result = await service.getTenantUsers(tenantId);
        expect(result.length).toBe(1);
        expect(result[0].id).toBe(mockClerkUser1.id);
        expect(result[0].roles).toEqual([]); // Roles should be empty
      });

    it('should throw BadRequestException if Clerk API call fails for memberships', async () => {
      mockClerkClient.organizations.getOrganizationMembershipList.mockRejectedValue(new Error('Clerk API Error'));
      await expect(service.getTenantUsers(tenantId)).rejects.toThrow(BadRequestException);
    });
  });

  // Placeholder for the new findById tests
  describe('findById (New Implementation)', () => {
    const userId = 'clerkUser123';

    it('should return a clerk user when found by clerkClient.users.getUser', async () => {
      mockClerkClient.users.getUser.mockResolvedValue(mockClerkUser);
      const result = await service.findById(userId);
      expect(mockClerkClient.users.getUser).toHaveBeenCalledWith({ userId });
      expect(result).toEqual(mockClerkUser);
    });

    it('should throw NotFoundException if clerkClient.users.getUser throws 404', async () => {
      const clerkNotFoundError = { status: 404, errors: [{ code: 'resource_not_found' }] } as any;
      mockClerkClient.users.getUser.mockRejectedValue(clerkNotFoundError);
      
      await expect(service.findById(userId)).rejects.toThrow(NotFoundException);
      expect(mockClerkClient.users.getUser).toHaveBeenCalledWith({ userId });
    });

    it('should throw BadRequestException for other clerkClient errors', async () => {
      const clerkOtherError = { status: 500, message: 'Clerk internal error' } as any;
      mockClerkClient.users.getUser.mockRejectedValue(clerkOtherError);

      await expect(service.findById(userId)).rejects.toThrow(BadRequestException);
      expect(mockClerkClient.users.getUser).toHaveBeenCalledWith({ userId });
    });
  });
  
  describe('updateUserRole', () => {
    const userIdToUpdate = 'userToUpdateRoles123';
    const tenantIdForUpdate = 'tenantForRoleUpdate123';
    const newRolesToAssign = [UserRole.ADMIN, UserRole.MANAGER];
    
    const mockAdminRoleEntity = { id: 2, name: UserRole.ADMIN } as Role;
    const mockManagerRoleEntity = { id: 3, name: UserRole.MANAGER } as Role;
    const roleEntitiesToAssign = [mockAdminRoleEntity, mockManagerRoleEntity];

    const mockUserForUpdate = {
      ...mockLocalUserEntity,
      id: userIdToUpdate,
      clerkId: userIdToUpdate,
      roles: [mockRoleEntity], // Initial role: MEMBER
      activeTenantId: tenantIdForUpdate, // Assume user is active in this tenant
    };
    
    const mockMembershipForUserInTenant = { // From Clerk: users.getOrganizationMembershipList
        id: `mem_${userIdToUpdate}`,
        organization: { id: tenantIdForUpdate, name: 'Tenant For Update', slug: 'tenant-for-update' },
        publicUserData: { userId: userIdToUpdate, firstName: 'Test', lastName: 'User', identifier: 'test@clerk.com', imageUrl: '' },
        role: 'org:member', 
        createdAt: Date.now(), 
        updatedAt: Date.now()
    };

    it('should update user roles successfully', async () => {
      // User is a member of the tenant in Clerk
      mockClerkClient.users.getOrganizationMembershipList.mockResolvedValue({ data: [mockMembershipForUserInTenant as any], totalCount: 1 });
      // Local user exists
      userRepository.findOne.mockResolvedValue(mockUserForUpdate);
      // Roles to assign exist
      roleRepository.find.mockResolvedValue(roleEntitiesToAssign);
      // Save operation
      const expectedSavedUser = { ...mockUserForUpdate, roles: roleEntitiesToAssign };
      userRepository.save.mockResolvedValue(expectedSavedUser);

      const result = await service.updateUserRole(userIdToUpdate, newRolesToAssign, tenantIdForUpdate);

      expect(mockClerkClient.users.getOrganizationMembershipList).toHaveBeenCalledWith({ userId: userIdToUpdate });
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: userIdToUpdate }, relations: ['roles'] });
      expect(roleRepository.find).toHaveBeenCalledWith({ where: newRolesToAssign.map(name => ({ name })) });
      expect(userRepository.save).toHaveBeenCalledWith(expect.objectContaining({ roles: roleEntitiesToAssign }));
      expect(result.roles).toEqual(roleEntitiesToAssign);
    });

    it('should throw BadRequestException if user is not a member of the tenant in Clerk', async () => {
      mockClerkClient.users.getOrganizationMembershipList.mockResolvedValue({ data: [], totalCount: 0 }); // Not a member

      await expect(service.updateUserRole(userIdToUpdate, newRolesToAssign, tenantIdForUpdate))
        .rejects.toThrow(new BadRequestException(`User ${userIdToUpdate} is not a member of tenant ${tenantIdForUpdate}`));
      
      expect(userRepository.findOne).not.toHaveBeenCalled();
      expect(roleRepository.find).not.toHaveBeenCalled();
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if local user record not found', async () => {
      mockClerkClient.users.getOrganizationMembershipList.mockResolvedValue({ data: [mockMembershipForUserInTenant as any], totalCount: 1 });
      userRepository.findOne.mockResolvedValue(null); // Local user not found

      await expect(service.updateUserRole(userIdToUpdate, newRolesToAssign, tenantIdForUpdate))
        .rejects.toThrow(new NotFoundException(`User ${userIdToUpdate} not found in local database for role assignment.`));

      expect(roleRepository.find).not.toHaveBeenCalled();
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if one or more roles to assign are not found', async () => {
      mockClerkClient.users.getOrganizationMembershipList.mockResolvedValue({ data: [mockMembershipForUserInTenant as any], totalCount: 1 });
      userRepository.findOne.mockResolvedValue(mockUserForUpdate);
      roleRepository.find.mockResolvedValue([mockAdminRoleEntity]); // Only Admin role found, Manager is missing

      await expect(service.updateUserRole(userIdToUpdate, newRolesToAssign, tenantIdForUpdate))
        .rejects.toThrow(new BadRequestException(`One or more roles not found: ${UserRole.MANAGER}`));
      
      expect(userRepository.save).not.toHaveBeenCalled();
    });
    
    it('should re-throw BadRequestException from Clerk client if it occurs during membership check', async () => {
        const clerkError = new BadRequestException("Clerk client error");
        mockClerkClient.users.getOrganizationMembershipList.mockRejectedValue(clerkError);
  
        await expect(service.updateUserRole(userIdToUpdate, newRolesToAssign, tenantIdForUpdate))
          .rejects.toThrow(clerkError);
      });
  });
  
  // Placeholder for findUserWithRelations tests
  describe('findUserWithRelations', () => {
    const userId = 'clerkUser123';
    const mockFullClerkUser = { // More complete Clerk User for this test
        ...mockClerkUser,
        emailAddresses: [{ id: 'email_id_1', emailAddress: 'clerk@example.com' }],
        primaryEmailAddressId: 'email_id_1',
        username: 'clerk_username',
        firstName: 'ClerkFirstName',
        lastName: 'ClerkLastName',
        imageUrl: 'http://example.com/image.png',
        publicMetadata: { activeTenantId: 'tenant123' },
        createdAt: new Date().valueOf(),
        updatedAt: new Date().valueOf(),
      } as unknown as ClerkUserType;

    const mockLocalUserWithRoles = {
      ...mockLocalUserEntity,
      id: userId,
      clerkId: userId,
      roles: [mockRoleEntity],
      tenants: [{ id: 'tenant123', name: 'Test Tenant' } as Tenant], // Example tenant
    };

    it('should return combined user data with local roles and tenants', async () => {
      mockClerkClient.users.getUser.mockResolvedValue(mockFullClerkUser);
      userRepository.findOne.mockResolvedValue(mockLocalUserWithRoles);

      const result = await service.findUserWithRelations(userId);

      expect(mockClerkClient.users.getUser).toHaveBeenCalledWith({ userId });
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
        relations: ['roles', 'tenants'],
      });
      
      expect(result.id).toBe(mockFullClerkUser.id);
      expect(result.firstName).toBe(mockFullClerkUser.firstName);
      expect(result.lastName).toBe(mockFullClerkUser.lastName);
      expect(result.email).toBe('clerk@example.com'); // Primary email
      expect(result.profilePicture).toBe(mockFullClerkUser.imageUrl);
      expect(result.roles).toEqual(mockLocalUserWithRoles.roles);
      expect(result.tenants).toEqual(mockLocalUserWithRoles.tenants);
      // Ensure timestamps are Date objects
      expect(result.createdAt).toEqual(new Date(mockFullClerkUser.createdAt)); 
      expect(result.updatedAt).toEqual(new Date(mockFullClerkUser.updatedAt));
    });

    it('should throw NotFoundException if Clerk user not found', async () => {
      const clerkNotFoundError = { status: 404, errors: [{ code: 'resource_not_found' }] } as any;
      mockClerkClient.users.getUser.mockRejectedValue(clerkNotFoundError);

      await expect(service.findUserWithRelations(userId)).rejects.toThrow(NotFoundException);
      expect(mockClerkClient.users.getUser).toHaveBeenCalledWith({ userId });
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return Clerk user data with empty roles/tenants if local user not found', async () => {
      mockClerkClient.users.getUser.mockResolvedValue(mockFullClerkUser);
      userRepository.findOne.mockResolvedValue(null); // No local record

      const result = await service.findUserWithRelations(userId);

      expect(mockClerkClient.users.getUser).toHaveBeenCalledWith({ userId });
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
        relations: ['roles', 'tenants'],
      });

      expect(result.id).toBe(mockFullClerkUser.id);
      expect(result.firstName).toBe(mockFullClerkUser.firstName);
      expect(result.roles).toEqual([]);
      expect(result.tenants).toEqual([]);
      // Check a few other key fields from Clerk user
      expect(result.email).toBe('clerk@example.com');
      expect(result.profilePicture).toBe(mockFullClerkUser.imageUrl);
    });
  });

  describe('validateUsersAreInTenant', () => {
    const tenantId = 'org_tenantValid123';
    let mockUserList: ClerkUserType[];

    beforeEach(() => {
      // Reset mockUserList for each test
      mockUserList = [
        {
          ...mockClerkUser, id: 'user1',
          organizationMemberships: [{ organization: { id: tenantId } } as any], // User1 is in tenant
        },
        {
          ...mockClerkUser, id: 'user2',
          organizationMemberships: [{ organization: { id: 'org_otherTenant' } } as any], // User2 is in another tenant
        },
        {
          ...mockClerkUser, id: 'user3',
          organizationMemberships: [{ organization: { id: tenantId } } as any, { organization: { id: 'org_otherTenant' } } as any], // User3 is in multiple, including target
        },
        {
          ...mockClerkUser, id: 'user4', // User4 has no organizationMemberships property for testing that case
          organizationMemberships: undefined, 
        },
        {
            ...mockClerkUser, id: 'user5', // User5 has empty organizationMemberships array
            organizationMemberships: [],
        },
      ];
      mockClerkClient.users.getUserList.mockResolvedValue({ data: [], totalCount: 0 }); // Default to no users found
    });

    it('should return empty arrays if userIds input is empty', async () => {
      const result = await service.validateUsersAreInTenant([], tenantId);
      expect(result.validClerkUsers).toEqual([]);
      expect(result.invalidUserIds).toEqual([]);
      expect(mockClerkClient.users.getUserList).not.toHaveBeenCalled();
    });

    it('should return all users as valid if all are found and in the tenant', async () => {
      const userIds = ['user1', 'user3'];
      const relevantUsers = mockUserList.filter(u => userIds.includes(u.id));
      mockClerkClient.users.getUserList.mockResolvedValue({ data: relevantUsers, totalCount: relevantUsers.length });
      
      const result = await service.validateUsersAreInTenant(userIds, tenantId);
      
      expect(mockClerkClient.users.getUserList).toHaveBeenCalledWith({ userId: userIds });
      expect(result.validClerkUsers.length).toBe(2);
      expect(result.validClerkUsers.map(u => u.id).sort()).toEqual(['user1', 'user3'].sort());
      expect(result.invalidUserIds).toEqual([]);
    });

    it('should correctly identify valid and invalid users (not in tenant)', async () => {
      const userIds = ['user1', 'user2']; // user1 in tenant, user2 not
      const relevantUsers = mockUserList.filter(u => userIds.includes(u.id));
      mockClerkClient.users.getUserList.mockResolvedValue({ data: relevantUsers, totalCount: relevantUsers.length });

      const result = await service.validateUsersAreInTenant(userIds, tenantId);
      expect(result.validClerkUsers.length).toBe(1);
      expect(result.validClerkUsers[0].id).toBe('user1');
      expect(result.invalidUserIds).toEqual(['user2']);
    });

    it('should correctly identify valid and invalid users (including not found in Clerk)', async () => {
      const userIds = ['user1', 'userNotFound', 'user2']; // user1 valid, userNotFound not in Clerk, user2 not in tenant
      const usersReturnedByClerk = mockUserList.filter(u => u.id === 'user1' || u.id === 'user2');
      mockClerkClient.users.getUserList.mockResolvedValue({ data: usersReturnedByClerk, totalCount: usersReturnedByClerk.length });

      const result = await service.validateUsersAreInTenant(userIds, tenantId);
      expect(result.validClerkUsers.length).toBe(1);
      expect(result.validClerkUsers[0].id).toBe('user1');
      expect(result.invalidUserIds.sort()).toEqual(['userNotFound', 'user2'].sort());
    });
    
    it('should handle users with undefined or empty organizationMemberships as not in tenant', async () => {
        const userIds = ['user1', 'user4', 'user5']; // user1 valid, user4 undefined memberships, user5 empty memberships
        const relevantUsers = mockUserList.filter(u => userIds.includes(u.id));
        mockClerkClient.users.getUserList.mockResolvedValue({ data: relevantUsers, totalCount: relevantUsers.length });
  
        const result = await service.validateUsersAreInTenant(userIds, tenantId);
        expect(result.validClerkUsers.length).toBe(1);
        expect(result.validClerkUsers[0].id).toBe('user1');
        expect(result.invalidUserIds.sort()).toEqual(['user4', 'user5'].sort());
      });

    it('should return all users as invalid if none are in the tenant', async () => {
      const userIds = ['user2', 'user4'];
      const relevantUsers = mockUserList.filter(u => userIds.includes(u.id));
      mockClerkClient.users.getUserList.mockResolvedValue({ data: relevantUsers, totalCount: relevantUsers.length });
      
      const result = await service.validateUsersAreInTenant(userIds, tenantId);
      expect(result.validClerkUsers).toEqual([]);
      expect(result.invalidUserIds.sort()).toEqual(['user2', 'user4'].sort());
    });

    it('should return all userIds as invalid if Clerk returns no users', async () => {
      const userIds = ['userNotFound1', 'userNotFound2'];
      mockClerkClient.users.getUserList.mockResolvedValue({ data: [], totalCount: 0 }); // No users found

      const result = await service.validateUsersAreInTenant(userIds, tenantId);
      expect(result.validClerkUsers).toEqual([]);
      expect(result.invalidUserIds.sort()).toEqual(userIds.sort());
    });
    
    it('should return all userIds as invalid if clerkClient.users.getUserList throws an error', async () => {
        const userIds = ['user1', 'user2'];
        const clerkError = new Error('Clerk API error');
        mockClerkClient.users.getUserList.mockRejectedValue(clerkError);
  
        const result = await service.validateUsersAreInTenant(userIds, tenantId);
        expect(result.validClerkUsers).toEqual([]);
        expect(result.invalidUserIds.sort()).toEqual(userIds.sort());
        expect(loggerMock.error).toHaveBeenCalledWith(
            { error: clerkError, userIds, tenantId },
            'Error fetching users from Clerk in validateUsersAreInTenant'
          );
      });

    it('should handle mixed case: some found and valid, some found but not in tenant, some not found in Clerk', async () => {
      const userIds = ['user1', 'user2', 'user3', 'userNotFound', 'user4', 'user5'];
      // user1 (valid), user2 (not in tenant), user3 (valid), user4 (no membership prop), user5 (empty membership array)
      // userNotFound (not in Clerk)
      const usersReturnedByClerk = mockUserList.filter(u => u.id !== 'userNotFound'); // All except userNotFound
      mockClerkClient.users.getUserList.mockResolvedValue({ data: usersReturnedByClerk, totalCount: usersReturnedByClerk.length });

      const result = await service.validateUsersAreInTenant(userIds, tenantId);
      
      expect(result.validClerkUsers.map(u => u.id).sort()).toEqual(['user1', 'user3'].sort());
      expect(result.invalidUserIds.sort()).toEqual(['user2', 'user4', 'user5', 'userNotFound'].sort());
    });

    // Note: The current implementation of `validateUsersAreInTenant` does not use the N+1 fallback
    // `clerkClient.organizations.getOrganizationMembershipList`. If that part were to be activated,
    // additional tests would be needed to cover its mocking and behavior.
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
