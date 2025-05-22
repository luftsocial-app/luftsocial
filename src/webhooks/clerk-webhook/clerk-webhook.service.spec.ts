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

    it('should handle user deletion', async () => {
      // No specific return value for deleteUser in service, so no mockResolvedValue needed
      await service.handleUserDeleted(mockUserWebhookData as any);
      expect(mockUserService.deleteUser).toHaveBeenCalledWith(mockUserWebhookData);
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
            email: mockMembershipCreatedEvent.data.email_addresses[0].email_address,
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
            activeTenantId: mockMembershipUpdatedEvent.data.activeTenantId 
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
            activeTenantId: mockMembershipDeletedEvent.data.activeTenantId 
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
      expect(() => service.verifyWebhook(mockRequest)).toThrow(BadRequestException);
      expect(() => service.verifyWebhook(mockRequest)).toThrow('Missing svix-id header');
    });
    
    it('should throw BadRequestException if svix-timestamp header is missing', () => {
      delete mockRequest.headers['svix-timestamp'];
      expect(() => service.verifyWebhook(mockRequest)).toThrow(BadRequestException);
      expect(() => service.verifyWebhook(mockRequest)).toThrow('Missing svix-timestamp header');
    });

    it('should throw BadRequestException if svix-signature header is missing', () => {
      delete mockRequest.headers['svix-signature'];
      expect(() => service.verifyWebhook(mockRequest)).toThrow(BadRequestException);
      expect(() => service.verifyWebhook(mockRequest)).toThrow('Missing svix-signature header');
    });


    it('should throw BadRequestException if wh.verify throws an error (invalid signature)', () => {
      mockVerify.mockImplementation(() => {
        throw new Error('Invalid signature');
      });
      expect(() => service.verifyWebhook(mockRequest)).toThrow(BadRequestException);
      expect(() => service.verifyWebhook(mockRequest)).toThrow('Invalid signature');
    });

    it('should throw InternalServerErrorException if SIGNING_SECRET is undefined', () => {
      delete process.env.SIGNING_SECRET; // Or set to undefined
      // Need to re-instantiate service or ensure it re-reads env, or make SIGNING_SECRET a param
      // For this test structure, we assume the service constructor or method accesses process.env directly.
      // If it's cached at construction, this test might need adjustment.
      // The current implementation of ClerkWebhookService likely reads it on each call or at construction.
      // If at construction, the test setup would need to be more involved.
      // Assuming direct access in method or re-evaluation:
      expect(() => service.verifyWebhook(mockRequest)).toThrow(InternalServerErrorException);
      expect(() => service.verifyWebhook(mockRequest)).toThrow('SIGNING_SECRET is not defined in environment variables.');
    });
  });
});
