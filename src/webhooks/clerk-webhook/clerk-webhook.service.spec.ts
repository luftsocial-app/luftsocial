import { Test, TestingModule } from '@nestjs/testing';
import { ClerkWebhookService } from './clerk-webhook.service';
import { UserTenantService } from '../../user-management/user-tenant.service';
import { PinoLogger } from 'nestjs-pino';
import { UserService } from '../../user-management/user.service';
import { TenantService } from '../../user-management/tenant.service';
import { UserWebhookEvent } from '@clerk/express';
import { User } from '../../user-management/entities/user.entity';
import { Tenant } from '../../user-management/entities/tenant.entity';
import { UserRole } from '../../common/enums/roles';
import { BadRequestException } from '@nestjs/common';

// Mock PinoLogger
const mockPinoLogger = {
  setContext: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('ClerkWebhookService', () => {
  let service: ClerkWebhookService;
  let mockTenantService: jest.Mocked<TenantService>;
  let mockUserService: jest.Mocked<UserService>;
  // UserTenantService is also a dependency but not directly interacted with in handleUserCreated logic being tested here.
  // If other methods were tested, it would need full mocking.

  const mockUserId = 'user_clerk123abc';
  const mockPersonalTenantId = 'personal-tenant-uuid-456';
  const mockOrgTenantId = 'org-tenant-uuid-789';

  const mockUserService = {
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(), // Added deleteUser mock
  };

  const mockUserTenantService = {
    addMembership: jest.fn(),
    deleteMembership: jest.fn(),
    updateMembership: jest.fn(),
    executeOperation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClerkWebhookService,
        {
          provide: TenantService,
          useValue: {
            createPersonalTenant: jest.fn(),
            // Mock other TenantService methods if needed by other tests
            createTenant: jest.fn(),
            updateTenant: jest.fn(),
            deleteTenant: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            createUser: jest.fn(),
            updateUserRole: jest.fn(),
            // Mock other UserService methods if needed by other tests
            updateUser: jest.fn(),
            deleteUser: jest.fn(),
          },
        },
        {
          provide: UserTenantService, // UserTenantService is used for membership events
          useValue: { executeOperation: jest.fn() },
        },
        { provide: PinoLogger, useValue: mockPinoLogger },
      ],
    }).compile();

    service = module.get<ClerkWebhookService>(ClerkWebhookService);
    mockTenantService = module.get(TenantService);
    mockUserService = module.get(UserService);

    jest.clearAllMocks();
  });

  describe('handleUserCreated', () => {
    const baseUserWebhookEventData = {
      id: mockUserId,
      email_addresses: [{ id: 'ead1', email_address: 'test@example.com' }],
      primary_email_address_id: 'ead1',
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
      organization_memberships: [], // Default to no org memberships
    };

    it('should create personal tenant and assign admin role if user has no organization affiliation', async () => {
      const userCreatedEventNoOrg: UserWebhookEvent = {
        type: 'user.created',
        data: { ...baseUserWebhookEventData, organization_memberships: [] },
      };

      mockTenantService.createPersonalTenant.mockResolvedValue(
        mockPersonalTenantEntity,
      );
      mockUserService.createUser.mockResolvedValue(mockUserEntity);
      mockUserService.updateUserRole.mockResolvedValue(mockUserEntity); // Assume it returns the updated user

      const result = await service.handleUserCreated(userCreatedEventNoOrg);

      expect(mockTenantService.createPersonalTenant).toHaveBeenCalledWith(
        userCreatedEventNoOrg.data,
      );
      expect(mockUserService.createUser).toHaveBeenCalledWith(
        userCreatedEventNoOrg,
        mockPersonalTenantId,
      );
      expect(mockUserService.updateUserRole).toHaveBeenCalledWith(
        mockUserId,
        [UserRole.ADMIN],
        mockPersonalTenantId,
      );
      expect(result).toEqual(mockUserEntity);
    });

    it('should use primary organization ID as active tenant if user has organization affiliation', async () => {
      const userCreatedEventWithOrg: UserWebhookEvent = {
        type: 'user.created',
        data: {
          ...baseUserWebhookEventData,
          primary_organization_id: 'orgmem1',
          organization_memberships: [
            {
              id: 'orgmem1',
              organization: { id: mockOrgTenantId, name: 'Org1', slug: 'org1' },
            },
            {
              id: 'orgmem2',
              organization: { id: 'other-org-id', name: 'Org2', slug: 'org2' },
            },
          ],
        },
      };

      mockUserService.createUser.mockResolvedValue(mockUserEntity);

      const result = await service.handleUserCreated(userCreatedEventWithOrg);

      expect(mockTenantService.createPersonalTenant).not.toHaveBeenCalled();
      expect(mockUserService.createUser).toHaveBeenCalledWith(
        userCreatedEventWithOrg,
        mockOrgTenantId,
      );
      expect(mockUserService.updateUserRole).not.toHaveBeenCalled(); // Role assignment in orgs handled by membership events
      expect(result).toEqual(mockUserEntity);
    });

    it('should use first organization ID if primary_organization_id is null but memberships exist', async () => {
      const userCreatedEventWithOrgNoPrimary: UserWebhookEvent = {
        type: 'user.created',
        data: {
          ...baseUserWebhookEventData,
          primary_organization_id: null, // No primary specified
          organization_memberships: [
            // But memberships exist
            {
              id: 'orgmem1',
              organization: { id: mockOrgTenantId, name: 'Org1', slug: 'org1' },
            },
          ],
        },
      };

      mockUserService.createUser.mockResolvedValue(mockUserEntity);

      await service.handleUserCreated(userCreatedEventWithOrgNoPrimary);

      expect(mockTenantService.createPersonalTenant).not.toHaveBeenCalled();
      expect(mockUserService.createUser).toHaveBeenCalledWith(
        userCreatedEventWithOrgNoPrimary,
        mockOrgTenantId,
      );
    });

    it('should throw BadRequestException if tenantId cannot be determined (should not happen with personal tenant fallback)', async () => {
      // This scenario is hard to trigger perfectly if personal tenant creation is robust,
      // but we can simulate a failure in createPersonalTenant.
      const userCreatedEventNoOrg: UserWebhookEvent = {
        type: 'user.created',
        data: { ...baseUserWebhookEventData, organization_memberships: [] },
      };
      mockTenantService.createPersonalTenant.mockRejectedValue(
        new Error('Failed to create personal tenant'),
      );

      await expect(
        service.handleUserCreated(userCreatedEventNoOrg),
      ).rejects.toThrow(BadRequestException);
    });

    it('should proceed with user creation even if assigning admin role fails for personal tenant', async () => {
      const userCreatedEventNoOrg: UserWebhookEvent = {
        type: 'user.created',
        data: { ...baseUserWebhookEventData, organization_memberships: [] },
      };

      mockTenantService.createPersonalTenant.mockResolvedValue(
        mockPersonalTenantEntity,
      );
      mockUserService.createUser.mockResolvedValue(mockUserEntity);
      mockUserService.updateUserRole.mockRejectedValue(
        new Error('Failed to assign role'),
      ); // Role assignment fails

      const result = await service.handleUserCreated(userCreatedEventNoOrg);

      expect(mockTenantService.createPersonalTenant).toHaveBeenCalled();
      expect(mockUserService.createUser).toHaveBeenCalledWith(
        userCreatedEventNoOrg,
        mockPersonalTenantId,
      );
      expect(mockUserService.updateUserRole).toHaveBeenCalledWith(
        mockUserId,
        [UserRole.ADMIN],
        mockPersonalTenantId,
      );
      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        // Check if the error was logged
        expect.objectContaining({
          userId: mockUserId,
          tenantId: mockPersonalTenantId,
        }),
        'Error assigning Admin role to user in personal tenant. Continuing user creation process.',
      );
      expect(result).toEqual(mockUserEntity); // User creation should still succeed
    });
  });

  // --- Other Webhook Handler Tests (handleUserUpdated, handleTenantCreated, etc.) ---
  // These would be structured similarly, mocking relevant service calls.
  // For brevity, focusing on the modified handleUserCreated.

  describe('handleUserUpdated', () => {
    const mockUserWebhookDataUpdate = {
      type: 'user.updated',
      data: { id: mockUserId },
    } as UserWebhookEvent;
    it('should handle user update', async () => {
      mockUserService.updateUser.mockResolvedValue(mockUserEntity);

      const result = await service.handleUserUpdated(
        mockUserWebhookData as any,
      );

      expect(mockUserService.updateUser).toHaveBeenCalledWith(
        mockUserWebhookData,
      );
      expect(result).toEqual(mockUser);
    });

    it('should handle user deletion', async () => {
      // No specific return value for deleteUser in service, so no mockResolvedValue needed
      await service.handleUserDeleted(mockUserWebhookData as any);
      expect(mockUserService.deleteUser).toHaveBeenCalledWith(
        mockUserWebhookData,
      );
    });
  });

  // Example for Tenant Webhooks (structure remains similar to original, just ensure mocks are correctly typed)
  describe('Tenant Webhooks', () => {
    const mockOrgWebhookData = {
      data: {
        id: 'org123',
        name: 'Test Org',
      },
      type: 'organization.created', // Or other relevant types
    } as any; // Cast to any for simplicity if not using full OrganizationWebhookEvent type

    it('should handle tenant creation', async () => {
      await service.handleTenantCreated(mockOrgWebhookData);
      expect(mockTenantService.createTenant).toHaveBeenCalledWith(
        mockOrgWebhookData,
      );
    });

    it('should handle tenant update', async () => {
      await service.handleTenantUpdated(mockOrgWebhookData);
      expect(mockTenantService.updateTenant).toHaveBeenCalledWith(
        mockOrgWebhookData,
      );
    });

    it('should handle tenant deletion', async () => {
      await service.handleTenantDeleted(mockOrgWebhookData);
      expect(mockTenantService.deleteTenant).toHaveBeenCalledWith(
        mockOrgWebhookData,
      );
    });
  });

  // Membership webhooks would use mockUserTenantService.executeOperation
  describe('Membership Webhooks', () => {
    const baseMembershipData = {
      organization: { id: 'org_123' },
      public_user_data: {
        user_id: 'user_clerk_123',
        // For create, these details might be present
        // For update/delete, only user_id might be consistently there from public_user_data
      },
      // For update/delete, activeTenantId might be part of the main data object
    };

    const mockMembershipCreatedEvent = {
      data: {
        ...baseMembershipData,
        // Clerk's actual payload for user.created within organization.membership.created might be more nested or different.
        // Assuming the service method handleMembershipCreated extracts these details.
        // For the test, we'll assume the service method receives an object from which it can derive these.
        // The task implies these are top-level in the `data` object passed to executeOperation.
        // Let's simulate the data as the service expects it for executeOperation's userData.
        id: 'user_clerk_123', // Simulating that this is derived and passed
        email_addresses: [{ email_address: 'member@example.com' }], // Simulating derived
        first_name: 'Member', // Simulating derived
        last_name: 'User', // Simulating derived
        role: 'basic_member', // role might be part of membership data
      },
      type: 'organizationMembership.created',
    } as any;

    const mockMembershipUpdatedEvent = {
      data: {
        ...baseMembershipData,
        // For update, activeTenantId for the user might be relevant if it's part of the event
        // Or it might be implicit if the user's context within the tenant changes.
        // The task specifies `activeTenantId` in `userData`.
        activeTenantId: 'org_123', // Assuming this is part of the event or derived
        role: 'admin', // Example: role updated
      },
      type: 'organizationMembership.updated',
    } as any;

    const mockMembershipDeletedEvent = {
      data: {
        ...baseMembershipData,
        activeTenantId: 'org_123', // As specified by task for userData
      },
      type: 'organizationMembership.deleted',
    } as any;

    it('should handle membership creation', async () => {
      mockUserTenantService.executeOperation.mockResolvedValue(undefined); // Assuming it returns void or some status

      await service.handleMembershipCreated(mockMembershipCreatedEvent);

      expect(mockUserTenantService.executeOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operationType: 'ADD',
          userId: mockMembershipCreatedEvent.data.public_user_data.user_id,
          tenantId: mockMembershipCreatedEvent.data.organization.id,
          userData: expect.objectContaining({
            id: mockMembershipCreatedEvent.data.id, // or public_user_data.user_id
            email:
              mockMembershipCreatedEvent.data.email_addresses[0].email_address,
            firstName: mockMembershipCreatedEvent.data.first_name,
            lastName: mockMembershipCreatedEvent.data.last_name,
          }),
          role: mockMembershipCreatedEvent.data.role,
        }),
      );
    });

    it('should handle membership update', async () => {
      mockUserTenantService.executeOperation.mockResolvedValue(undefined);
      await service.handleMembershipUpdated(mockMembershipUpdatedEvent);
      expect(mockUserTenantService.executeOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operationType: 'UPDATE',
          userId: mockMembershipUpdatedEvent.data.public_user_data.user_id,
          tenantId: mockMembershipUpdatedEvent.data.organization.id,
          userData: expect.objectContaining({
            activeTenantId: mockMembershipUpdatedEvent.data.activeTenantId,
          }),
          role: mockMembershipUpdatedEvent.data.role,
        }),
      );
    });

    it('should handle membership deletion', async () => {
      mockUserTenantService.executeOperation.mockResolvedValue(undefined);
      await service.handleMembershipDeleted(mockMembershipDeletedEvent);
      expect(mockUserTenantService.executeOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operationType: 'REMOVE',
          userId: mockMembershipDeletedEvent.data.public_user_data.user_id,
          tenantId: mockMembershipDeletedEvent.data.organization.id,
          userData: expect.objectContaining({
            activeTenantId: mockMembershipDeletedEvent.data.activeTenantId,
          }),
        }),
      );
    });
  });

  describe('verifyWebhook', () => {
    let mockRequest;
    const mockBody = { some: 'payload' };
    const mockSvixId = 'svix_id_123';
    const mockSvixTimestamp = '1678886400';
    const mockSvixSignature = 'v1,signature_value';
    const mockSigningSecret = 'whsec_test_secret';

    // Mock svix library
    const mockVerify = jest.fn();
    jest.mock('svix', () => ({
      Webhook: jest.fn().mockImplementation(() => ({
        verify: mockVerify,
      })),
    }));

    beforeEach(() => {
      mockVerify.mockReset(); // Reset verify mock before each test
      // Mock process.env
      process.env.SIGNING_SECRET = mockSigningSecret;

      mockRequest = {
        headers: {
          'svix-id': mockSvixId,
          'svix-timestamp': mockSvixTimestamp,
          'svix-signature': mockSvixSignature,
        },
        rawBody: Buffer.from(JSON.stringify(mockBody)), // Simulate rawBody
      } as any;
    });

    afterEach(() => {
      // Clean up environment variable mock
      delete process.env.SIGNING_SECRET;
    });

    it('should successfully verify a valid webhook', () => {
      mockVerify.mockReturnValue(mockBody); // Simulate successful verification

      const result = service.verifyWebhook(mockRequest);
      expect(result).toEqual(mockBody);
      expect(mockVerify).toHaveBeenCalledWith(mockRequest.rawBody.toString(), {
        'svix-id': mockSvixId,
        'svix-timestamp': mockSvixTimestamp,
        'svix-signature': mockSvixSignature,
      });
    });

    it('should throw BadRequestException if svix-id header is missing', () => {
      delete mockRequest.headers['svix-id'];
      expect(() => service.verifyWebhook(mockRequest)).toThrow(
        BadRequestException,
      );
      expect(() => service.verifyWebhook(mockRequest)).toThrow(
        'Missing svix-id header',
      );
    });

    it('should throw BadRequestException if svix-timestamp header is missing', () => {
      delete mockRequest.headers['svix-timestamp'];
      expect(() => service.verifyWebhook(mockRequest)).toThrow(
        BadRequestException,
      );
      expect(() => service.verifyWebhook(mockRequest)).toThrow(
        'Missing svix-timestamp header',
      );
    });

    it('should throw BadRequestException if svix-signature header is missing', () => {
      delete mockRequest.headers['svix-signature'];
      expect(() => service.verifyWebhook(mockRequest)).toThrow(
        BadRequestException,
      );
      expect(() => service.verifyWebhook(mockRequest)).toThrow(
        'Missing svix-signature header',
      );
    });

    it('should throw BadRequestException if wh.verify throws an error (invalid signature)', () => {
      mockVerify.mockImplementation(() => {
        throw new Error('Invalid signature');
      });
      expect(() => service.verifyWebhook(mockRequest)).toThrow(
        BadRequestException,
      );
      expect(() => service.verifyWebhook(mockRequest)).toThrow(
        'Invalid signature',
      );
    });

    it('should throw InternalServerErrorException if SIGNING_SECRET is undefined', () => {
      delete process.env.SIGNING_SECRET; // Or set to undefined
      // Need to re-instantiate service or ensure it re-reads env, or make SIGNING_SECRET a param
      // For this test structure, we assume the service constructor or method accesses process.env directly.
      // If it's cached at construction, this test might need adjustment.
      // The current implementation of ClerkWebhookService likely reads it on each call or at construction.
      // If at construction, the test setup would need to be more involved.
      // Assuming direct access in method or re-evaluation:
      expect(() => service.verifyWebhook(mockRequest)).toThrow(
        InternalServerErrorException,
      );
      expect(() => service.verifyWebhook(mockRequest)).toThrow(
        'SIGNING_SECRET is not defined in environment variables.',
      );
    });
  });
});
