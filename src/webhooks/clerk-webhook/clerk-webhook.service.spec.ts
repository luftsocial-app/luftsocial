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

  const mockUserEntity = { id: mockUserId, email: 'test@example.com' } as User;
  const mockPersonalTenantEntity = { id: mockPersonalTenantId, name: "Test's Workspace" } as Tenant;

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

      mockTenantService.createPersonalTenant.mockResolvedValue(mockPersonalTenantEntity);
      mockUserService.createUser.mockResolvedValue(mockUserEntity);
      mockUserService.updateUserRole.mockResolvedValue(mockUserEntity); // Assume it returns the updated user

      const result = await service.handleUserCreated(userCreatedEventNoOrg);

      expect(mockTenantService.createPersonalTenant).toHaveBeenCalledWith(userCreatedEventNoOrg.data);
      expect(mockUserService.createUser).toHaveBeenCalledWith(userCreatedEventNoOrg, mockPersonalTenantId);
      expect(mockUserService.updateUserRole).toHaveBeenCalledWith(mockUserId, [UserRole.ADMIN], mockPersonalTenantId);
      expect(result).toEqual(mockUserEntity);
    });

    it('should use primary organization ID as active tenant if user has organization affiliation', async () => {
      const userCreatedEventWithOrg: UserWebhookEvent = {
        type: 'user.created',
        data: {
          ...baseUserWebhookEventData,
          primary_organization_id: 'orgmem1',
          organization_memberships: [
            { id: 'orgmem1', organization: { id: mockOrgTenantId, name: 'Org1', slug: 'org1' } },
            { id: 'orgmem2', organization: { id: 'other-org-id', name: 'Org2', slug: 'org2' } },
          ],
        },
      };

      mockUserService.createUser.mockResolvedValue(mockUserEntity);

      const result = await service.handleUserCreated(userCreatedEventWithOrg);

      expect(mockTenantService.createPersonalTenant).not.toHaveBeenCalled();
      expect(mockUserService.createUser).toHaveBeenCalledWith(userCreatedEventWithOrg, mockOrgTenantId);
      expect(mockUserService.updateUserRole).not.toHaveBeenCalled(); // Role assignment in orgs handled by membership events
      expect(result).toEqual(mockUserEntity);
    });
    
    it('should use first organization ID if primary_organization_id is null but memberships exist', async () => {
        const userCreatedEventWithOrgNoPrimary: UserWebhookEvent = {
          type: 'user.created',
          data: {
            ...baseUserWebhookEventData,
            primary_organization_id: null, // No primary specified
            organization_memberships: [ // But memberships exist
              { id: 'orgmem1', organization: { id: mockOrgTenantId, name: 'Org1', slug: 'org1' } },
            ],
          },
        };
  
        mockUserService.createUser.mockResolvedValue(mockUserEntity);
  
        await service.handleUserCreated(userCreatedEventWithOrgNoPrimary);
  
        expect(mockTenantService.createPersonalTenant).not.toHaveBeenCalled();
        expect(mockUserService.createUser).toHaveBeenCalledWith(userCreatedEventWithOrgNoPrimary, mockOrgTenantId);
      });

    it('should throw BadRequestException if tenantId cannot be determined (should not happen with personal tenant fallback)', async () => {
        // This scenario is hard to trigger perfectly if personal tenant creation is robust,
        // but we can simulate a failure in createPersonalTenant.
        const userCreatedEventNoOrg: UserWebhookEvent = {
            type: 'user.created',
            data: { ...baseUserWebhookEventData, organization_memberships: [] },
        };
        mockTenantService.createPersonalTenant.mockRejectedValue(new Error("Failed to create personal tenant"));
        
        await expect(service.handleUserCreated(userCreatedEventNoOrg)).rejects.toThrow(BadRequestException);
    });
    
    it('should proceed with user creation even if assigning admin role fails for personal tenant', async () => {
        const userCreatedEventNoOrg: UserWebhookEvent = {
            type: 'user.created',
            data: { ...baseUserWebhookEventData, organization_memberships: [] },
        };

        mockTenantService.createPersonalTenant.mockResolvedValue(mockPersonalTenantEntity);
        mockUserService.createUser.mockResolvedValue(mockUserEntity);
        mockUserService.updateUserRole.mockRejectedValue(new Error("Failed to assign role")); // Role assignment fails

        const result = await service.handleUserCreated(userCreatedEventNoOrg);

        expect(mockTenantService.createPersonalTenant).toHaveBeenCalled();
        expect(mockUserService.createUser).toHaveBeenCalledWith(userCreatedEventNoOrg, mockPersonalTenantId);
        expect(mockUserService.updateUserRole).toHaveBeenCalledWith(mockUserId, [UserRole.ADMIN], mockPersonalTenantId);
        expect(mockPinoLogger.error).toHaveBeenCalledWith( // Check if the error was logged
            expect.objectContaining({ userId: mockUserId, tenantId: mockPersonalTenantId }),
            'Error assigning Admin role to user in personal tenant. Continuing user creation process.',
        );
        expect(result).toEqual(mockUserEntity); // User creation should still succeed
    });

  });

  // --- Other Webhook Handler Tests (handleUserUpdated, handleTenantCreated, etc.) ---
  // These would be structured similarly, mocking relevant service calls.
  // For brevity, focusing on the modified handleUserCreated.

  describe('handleUserUpdated', () => {
    const mockUserWebhookDataUpdate = { type: 'user.updated', data: { id: mockUserId } } as UserWebhookEvent;
    it('should handle user update', async () => {
      mockUserService.updateUser.mockResolvedValue(mockUserEntity);

      const result = await service.handleUserUpdated(mockUserWebhookDataUpdate);
      expect(mockUserService.updateUser).toHaveBeenCalledWith(mockUserWebhookDataUpdate);
      expect(result).toEqual(mockUserEntity);
    });
  });

  // Example for Tenant Webhooks (structure remains similar to original, just ensure mocks are correctly typed)
  describe('Tenant Webhooks', () => {
    const mockOrgWebhookData = {
      data: {
        id: 'org123',
        name: 'Test Org',
      },
      type: 'organization.created' // Or other relevant types
    } as any; // Cast to any for simplicity if not using full OrganizationWebhookEvent type

    it('should handle tenant creation', async () => {
      await service.handleTenantCreated(mockOrgWebhookData);
      expect(mockTenantService.createTenant).toHaveBeenCalledWith(mockOrgWebhookData);
    });

    it('should handle tenant update', async () => {
      await service.handleTenantUpdated(mockOrgWebhookData);
      expect(mockTenantService.updateTenant).toHaveBeenCalledWith(mockOrgWebhookData);
    });

    it('should handle tenant deletion', async () => {
      await service.handleTenantDeleted(mockOrgWebhookData);
      expect(mockTenantService.deleteTenant).toHaveBeenCalledWith(mockOrgWebhookData);
    });
  });

  // Membership webhooks would use mockUserTenantService.executeOperation
  describe('Membership Webhooks', () => {
    const mockMembershipEvent = {
        type: 'organizationMembership.created',
        data: { 
            public_user_data: { user_id: 'user123', identifier: 'test@test.com', first_name: 'Test', last_name: 'User'}, 
            organization: { id: 'org123' },
            role: 'admin' 
        }
    } as any;

    it('should handle membership creation by calling executeOperation on UserTenantService', async () => {
      mockUserTenantService.executeOperation.mockResolvedValue({ success: true, message: 'ok' });
      await service.handleMembershipCreated(mockMembershipEvent);
      expect(mockUserTenantService.executeOperation).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user123',
        tenantId: 'org123',
        operationType: 'ADD',
      }));
    });
    // Similar tests for handleMembershipDeleted and handleMembershipUpdated
  });
});
