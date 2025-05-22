import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Tenant } from './entities/tenant.entity';
import { PinoLogger } from 'nestjs-pino';
import { TenantService } from './tenant.service';
import { CLERK_CLIENT } from '../clerk/clerk.provider'; // Import CLERK_CLIENT token
import { ClerkClient, Organization } from '@clerk/backend'; // For types

// Mock Clerk Organization
const mockClerkOrganization = {
  id: 'org_123clerk',
  name: 'Clerk Org Name',
  slug: 'clerk-org-name',
  createdAt: new Date().valueOf(),
  updatedAt: new Date().valueOf(),
  // Add other Organization fields if your service method uses them
} as unknown as Organization; // Using unknown for flexibility with partial mocks


describe('TenantService', () => {
  let service: TenantService;
  let mockTenantRepository: jest.Mocked<typeof mockTenantRepoMethods>; // Typed mock
  let mockClerkClient: jest.Mocked<ClerkClient>;

  // This mockTenant is for the local DB entity used by webhook handlers
  const mockDbTenant = {
    id: 'tenant123', // Matches webhook data usually
    name: 'Test Org DB',
    slug: 'test-org-db',
  } as Tenant;

  const mockTenantRepoMethods = {
    create: jest.fn().mockReturnValue(mockDbTenant),
    save: jest.fn().mockResolvedValue(mockDbTenant),
    findOne: jest.fn().mockResolvedValue(mockDbTenant),
    delete: jest.fn().mockResolvedValue(undefined), // delete usually doesn't return a value
  };
  
  const clerkClientMockFactory = (): jest.Mocked<ClerkClient> => ({
    organizations: {
      getOrganization: jest.fn().mockResolvedValue(mockClerkOrganization),
      getOrganizationList: jest.fn().mockResolvedValue({ data: [mockClerkOrganization], totalCount: 1 }),
    },
  } as unknown as jest.Mocked<ClerkClient>);


  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: getRepositoryToken(Tenant), useValue: mockTenantRepoMethods },
        {
          provide: PinoLogger,
          useValue: {
            info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), setContext: jest.fn(),
          },
        },
        {
          provide: CLERK_CLIENT,
          useFactory: clerkClientMockFactory,
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
    mockTenantRepository = module.get(getRepositoryToken(Tenant));
    mockClerkClient = module.get(CLERK_CLIENT);

    jest.clearAllMocks();
    // Reset default behaviors for Clerk client mocks if needed for specific tests
    mockClerkClient.organizations.getOrganization.mockResolvedValue(mockClerkOrganization);
    mockClerkClient.organizations.getOrganizationList.mockResolvedValue({ data: [mockClerkOrganization], totalCount: 1 });
  });
  
  describe('getTenantById', () => {
    const tenantId = 'org_123clerk';

    it('should return an organization from Clerk when found', async () => {
      const result = await service.getTenantById(tenantId);
      expect(mockClerkClient.organizations.getOrganization).toHaveBeenCalledWith({ organizationId: tenantId });
      expect(result).toEqual(mockClerkOrganization);
    });

    it('should throw NotFoundException if Clerk client indicates organization not found (e.g. 404 error)', async () => {
      const clerkNotFoundError = { status: 404, errors: [{ code: 'resource_not_found' }] } as any;
      mockClerkClient.organizations.getOrganization.mockRejectedValue(clerkNotFoundError);
      
      await expect(service.getTenantById(tenantId)).rejects.toThrow(NotFoundException);
      expect(mockClerkClient.organizations.getOrganization).toHaveBeenCalledWith({ organizationId: tenantId });
    });

    it('should re-throw other errors from Clerk client', async () => {
      const otherClerkError = new Error('Some other Clerk API error');
      mockClerkClient.organizations.getOrganization.mockRejectedValue(otherClerkError);

      await expect(service.getTenantById(tenantId)).rejects.toThrow(otherClerkError);
    });
  });

  describe('getAllTenants', () => {
    it('should return a list of organizations from Clerk', async () => {
      const result = await service.getAllTenants();
      expect(mockClerkClient.organizations.getOrganizationList).toHaveBeenCalled();
      expect(result).toEqual([mockClerkOrganization]); // .data is handled in the service
    });

    it('should return an empty list if Clerk returns no organizations', async () => {
      mockClerkClient.organizations.getOrganizationList.mockResolvedValue({ data: [], totalCount: 0 });
      const result = await service.getAllTenants();
      expect(result).toEqual([]);
    });

    it('should throw an error if Clerk client fails to get organization list', async () => {
      const clerkError = new Error('Failed to fetch list');
      mockClerkClient.organizations.getOrganizationList.mockRejectedValue(clerkError);
      await expect(service.getAllTenants()).rejects.toThrow(clerkError);
    });
  });

  describe('Webhook Handlers', () => {
    describe('handleTenantCreation', () => {
      const mockWebhookData = {
        data: {
          id: 'tenant123',
          name: 'Test Org',
          slug: 'test-org',
          created_at: '2023-01-01T00:00:00Z',
        },
      };

      it('should create new tenant from webhook data', async () => {
        mockTenantRepo.create.mockReturnValue(mockTenant);
        mockTenantRepo.save.mockResolvedValue(mockTenant);

        await service.createTenant(mockWebhookData as any);

        expect(mockTenantRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'tenant123',
            name: 'Test Org',
            slug: 'test-org',
          }),
        );
        expect(mockTenantRepo.save).toHaveBeenCalled();
      });
    });

    describe('handleTenantDeletion', () => {
      const mockWebhookData = {
        data: { id: 'tenant123' },
      };

      it('should delete tenant', async () => {
        mockTenantRepo.findOne.mockResolvedValue(mockTenant);

        await service.deleteTenant(mockWebhookData as any);

        expect(mockTenantRepo.delete).toHaveBeenCalledWith('tenant123');
      });

      it('should throw if tenant not found', async () => {
        mockTenantRepo.findOne.mockResolvedValue(null);

        await expect(
          service.deleteTenant(mockWebhookData as any),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('handleTenantUpdate', () => {
      const mockWebhookData = {
        data: {
          id: 'tenant123',
          name: 'Updated Org',
          updated_at: '2023-01-02T00:00:00Z',
        },
      };

      it('should update tenant', async () => {
        mockTenantRepo.findOne.mockResolvedValue(mockTenant);
        mockTenantRepo.save.mockResolvedValue({
          ...mockTenant,
          name: 'Updated Org',
        });

        await service.updateTenant(mockWebhookData as any);

        expect(mockTenantRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Updated Org' }),
        );
      });

      it('should return undefined if tenant not found', async () => {
        mockTenantRepo.findOne.mockResolvedValue(null);

        await expect(service.updateTenant(mockWebhookData as any))
          .toBeUndefined;
      });
    });
  });
});
