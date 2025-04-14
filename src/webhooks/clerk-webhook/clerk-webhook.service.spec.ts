import { Test, TestingModule } from '@nestjs/testing';
import { ClerkWebhookService } from './clerk-webhook.service';
import { TenantService } from '../../user-management/tenant/tenant.service';
import { UserService } from '../../user-management/user/user.service';

describe('ClerkWebhookService', () => {
  let service: ClerkWebhookService;
  // let tenantService: TenantService;
  // let userService: UserService;

  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
  };

  const mockTenantService = {
    handleTenantCreation: jest.fn(),
    handleTenantUpdate: jest.fn(),
    handleTenantDeletion: jest.fn(),
  };

  const mockUserService = {
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
        { provide: TenantService, useValue: mockTenantService },
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    service = module.get<ClerkWebhookService>(ClerkWebhookService);
    // tenantService = module.get<TenantService>(TenantService);
    // userService = module.get<UserService>(UserService);

    jest.clearAllMocks();
  });

  describe('User Webhooks', () => {
    const mockUserWebhookData = {
      data: {
        id: 'user123',
        email_addresses: [{ email_address: 'test@example.com' }],
      },
    };

    it('should handle user creation', async () => {
      mockUserService.handleUserCreation.mockResolvedValue(mockUser);

      const result = await service.createUser(mockUserWebhookData as any);

      expect(mockUserService.handleUserCreation).toHaveBeenCalledWith(
        mockUserWebhookData,
      );
      expect(result).toEqual(mockUser);
    });

    it('should handle user update', async () => {
      mockUserService.handleUserUpdate.mockResolvedValue(mockUser);

      const result = await service.updateUser(mockUserWebhookData as any);

      expect(mockUserService.handleUserUpdate).toHaveBeenCalledWith(
        mockUserWebhookData,
      );
      expect(result).toEqual(mockUser);
    });
  });

  describe('Tenant Webhooks', () => {
    const mockOrgWebhookData = {
      data: {
        id: 'org123',
        name: 'Test Org',
      },
    };

    it('should handle tenant creation', async () => {
      await service.tenantCreated(mockOrgWebhookData as any);
      expect(mockTenantService.handleTenantCreation).toHaveBeenCalledWith(
        mockOrgWebhookData,
      );
    });

    it('should handle tenant update', async () => {
      await service.tenantUpdated(mockOrgWebhookData as any);
      expect(mockTenantService.handleTenantUpdate).toHaveBeenCalledWith(
        mockOrgWebhookData,
      );
    });

    it('should handle tenant deletion', async () => {
      await service.tenantDeleted(mockOrgWebhookData as any);
      expect(mockTenantService.handleTenantDeletion).toHaveBeenCalledWith(
        mockOrgWebhookData,
      );
    });
  });

  describe('Membership Webhooks', () => {
    const mockMembershipData = {
      data: {
        public_user_data: { user_id: 'user123' },
        organization: { id: 'org123' },
      },
    };

    it('should handle membership creation', async () => {
      await service.membershipCreated(mockMembershipData as any);
      expect(mockUserService.handleMembershipCreated).toHaveBeenCalledWith(
        mockMembershipData,
      );
    });

    it('should handle membership deletion', async () => {
      await service.membershipDeleted(mockMembershipData as any);
      expect(mockUserService.handleMembershipDeleted).toHaveBeenCalledWith(
        mockMembershipData,
      );
    });

    it('should handle membership update', async () => {
      await service.membershipUpdated(mockMembershipData as any);
      expect(mockUserService.handleMembershipUpdated).toHaveBeenCalledWith(
        mockMembershipData,
      );
    });
  });
});
