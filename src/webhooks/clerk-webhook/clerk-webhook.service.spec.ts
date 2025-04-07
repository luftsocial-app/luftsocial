import { Test, TestingModule } from '@nestjs/testing';
import { ClerkWebhookService } from './clerk-webhook.service';
import { UserTenantService } from '../../user-management/user-tenant.service';
import { PinoLogger } from 'nestjs-pino';
import { UserService } from '../../user-management/user.service';
import { TenantService } from '../../user-management/tenant.service';

describe('ClerkWebhookService', () => {
  let service: ClerkWebhookService;
  // let tenantService: TenantService;
  // let userService: UserService;

  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
  };

  const mockTenantService = {
    createTenant: jest.fn(),
    updateTenant: jest.fn(),
    deleteTenant: jest.fn(),
  };

  const mockUserService = {
    createUser: jest.fn(),
    updateUser: jest.fn(),
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
        { provide: TenantService, useValue: mockTenantService },
        { provide: UserService, useValue: mockUserService },
        { provide: UserTenantService, useValue: mockUserTenantService },
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
      mockUserService.createUser.mockResolvedValue(mockUser);

      const result = await service.handleUserCreated(
        mockUserWebhookData as any,
      );

      expect(mockUserService.createUser).toHaveBeenCalledWith(
        mockUserWebhookData,
      );
      expect(result).toEqual(mockUser);
    });

    it('should handle user update', async () => {
      mockUserService.updateUser.mockResolvedValue(mockUser);

      const result = await service.handleUserUpdated(
        mockUserWebhookData as any,
      );

      expect(mockUserService.updateUser).toHaveBeenCalledWith(
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
      await service.handleTenantCreated(mockOrgWebhookData as any);
      expect(mockTenantService.createTenant).toHaveBeenCalledWith(
        mockOrgWebhookData,
      );
    });

    it('should handle tenant update', async () => {
      await service.handleTenantUpdated(mockOrgWebhookData as any);
      expect(mockTenantService.updateTenant).toHaveBeenCalledWith(
        mockOrgWebhookData,
      );
    });

    it('should handle tenant deletion', async () => {
      await service.handleTenantDeleted(mockOrgWebhookData as any);
      expect(mockTenantService.deleteTenant).toHaveBeenCalledWith(
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

    it('should handle membership creation', async () => {});

    it('should handle membership deletion', async () => {});

    it('should handle membership update', async () => {});
  });
});
