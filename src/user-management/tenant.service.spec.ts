import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { Tenant } from './entities/tenant.entity';
import { PinoLogger } from 'nestjs-pino';
import { TenantService } from './tenant.service';
import { Organization } from '@clerk/backend'; // For mocking Clerk Organization

// --- Mock Data Definitions ---
const mockLocalTenant = (id: string, name: string, slug: string): Tenant => ({
  id,
  name,
  slug,
  createdAt: new Date(),
  updatedAt: new Date(),
  users: [], // Assuming users relation exists on Tenant entity
});

const mockClerkOrganization = (id: string, name: string, slug: string): Organization => ({
  id,
  name,
  slug,
  publicMetadata: {},
  privateMetadata: {},
  createdAt: new Date().getTime(),
  updatedAt: new Date().getTime(),
  imageUrl: '',
  hasImage: false,
  membersCount: 1,
  adminDeleteEnabled: true,
  maxAllowedMemberships: 100,
});

describe('TenantService', () => {
  let service: TenantService;
  let tenantRepository: jest.Mocked<Repository<Tenant>>;
  let mockClerkClient;

  // Mock implementations for Clerk client organization methods
  const mockGetOrganization = jest.fn();
  const mockGetOrganizationList = jest.fn();

  beforeEach(async () => {
    // Reset Clerk client method mocks
    mockGetOrganization.mockReset();
    mockGetOrganizationList.mockReset();

    mockClerkClient = {
      organizations: {
        getOrganization: mockGetOrganization,
        getOrganizationList: mockGetOrganizationList,
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: { // Ensure all used TypeORM methods are mocked with jest.fn()
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(), // Added find if it's used
            delete: jest.fn(),
          },
        },
        {
          provide: PinoLogger,
          useValue: { // Basic mock for PinoLogger
            info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), setContext: jest.fn(),
          },
        },
        {
          provide: 'CLERK_CLIENT', // Provide the mock Clerk client
          useValue: mockClerkClient,
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
    tenantRepository = module.get(getRepositoryToken(Tenant));

    jest.clearAllMocks(); // Also clear Jest's internal mock state
  });
  
  // Placeholder for initial describe block to ensure file structure is valid
  describe('Initial Placeholder Test', () => {
    it('should be true', () => {
      expect(true).toBe(true);
    });
  });

  describe('Webhook Handlers', () => {
    // Webhook handler tests will be refactored here.
    // Example for createTenant (to be expanded as per instructions)
    describe('createTenant (Webhook)', () => {
      const tenantId = 'org_webhook_create_123';
      const tenantName = 'Webhook Created Org';
      const tenantSlug = 'webhook-created-org';
      const mockCreateOrgEvent = {
        data: {
          id: tenantId,
          name: tenantName,
          slug: tenantSlug,
          created_at: new Date().toISOString(),
        },
        type: 'organization.created'
      } as any;

      it('should create a new tenant if not found locally', async () => {
        tenantRepository.findOne.mockResolvedValue(null); // Tenant does not exist
        const newLocalTenant = mockLocalTenant(tenantId, tenantName, tenantSlug);
        tenantRepository.create.mockReturnValue(newLocalTenant);
        tenantRepository.save.mockResolvedValue(newLocalTenant);

        await service.createTenant(mockCreateOrgEvent);

        expect(tenantRepository.findOne).toHaveBeenCalledWith({ where: { id: tenantId } });
        expect(tenantRepository.create).toHaveBeenCalledWith(expect.objectContaining({
          id: tenantId,
          name: tenantName,
          slug: tenantSlug,
        }));
        expect(tenantRepository.save).toHaveBeenCalledWith(newLocalTenant);
      });

      it('should not create tenant if already exists locally', async () => {
        const existingLocalTenant = mockLocalTenant(tenantId, tenantName, tenantSlug);
        tenantRepository.findOne.mockResolvedValue(existingLocalTenant); // Tenant already exists

        await service.createTenant(mockCreateOrgEvent);

        expect(tenantRepository.findOne).toHaveBeenCalledWith({ where: { id: tenantId } });
        expect(tenantRepository.create).not.toHaveBeenCalled();
        expect(tenantRepository.save).not.toHaveBeenCalled();
        // Verify logger was called with info about skipping creation
        expect(service['logger'].info).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Tenant already exists. Skipping creation.'));
      });
    });
    // Further webhook handler tests (updateTenant, deleteTenant) will be added/refactored here.
  });

  describe('getTenantById', () => {
    const tenantId = 'org_get_by_id_123';
    const clerkOrgInstance = mockClerkOrganization(tenantId, 'Test Org By Id', 'test-org-by-id');

    it('should return organization if found in Clerk', async () => {
      mockGetOrganization.mockResolvedValue(clerkOrgInstance);

      const result = await service.getTenantById(tenantId);

      expect(mockGetOrganization).toHaveBeenCalledWith({ organizationId: tenantId });
      expect(result).toEqual(clerkOrgInstance);
    });

    it('should throw NotFoundException if organization not found in Clerk (404)', async () => {
      const clerkNotFoundError = { status: 404, errors: [{ code: 'organization_not_found' }] } as any;
      mockGetOrganization.mockRejectedValue(clerkNotFoundError);

      await expect(service.getTenantById(tenantId)).rejects.toThrow(
        new NotFoundException(`Tenant with ID ${tenantId} not found.`),
      );
      expect(mockGetOrganization).toHaveBeenCalledWith({ organizationId: tenantId });
    });
    
    it('should throw NotFoundException if organization not found (Clerk error code check)', async () => {
      // Simulate a Clerk error object that might not have a status but has a specific error code
      const clerkNotFoundErrorNoStatus = { errors: [{ code: 'organization_not_found', message: 'The organization could not be found.' }] } as any;
      mockGetOrganization.mockRejectedValue(clerkNotFoundErrorNoStatus);

      await expect(service.getTenantById(tenantId)).rejects.toThrow(
        new NotFoundException(`Tenant with ID ${tenantId} not found.`),
      );
    });

    it('should throw InternalServerErrorException if Clerk client throws an unexpected error', async () => {
      const unexpectedError = new Error('Clerk SDK is down');
      mockGetOrganization.mockRejectedValue(unexpectedError);

      await expect(service.getTenantById(tenantId)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockGetOrganization).toHaveBeenCalledWith({ organizationId: tenantId });
    });
  });

  describe('getTenantList', () => {
    const org1 = mockClerkOrganization('org_list_1', 'Org One', 'org-one');
    const org2 = mockClerkOrganization('org_list_2', 'Org Two', 'org-two');

    it('should return a list of organizations from Clerk', async () => {
      // Clerk SDK's getOrganizationList often returns an object with a data array.
      // However, the service method directly returns response or response.data
      // Let's assume the mock should directly return the array for simplicity if that's what the service expects after handling response.data
      mockGetOrganizationList.mockResolvedValue([org1, org2]); 

      const result = await service.getTenantList();

      expect(mockGetOrganizationList).toHaveBeenCalledWith({}); // Default empty params
      expect(result).toEqual([org1, org2]);
    });
    
    it('should return a list of organizations from Clerk when response is {data: Organization[]}', async () => {
      // Test the case where Clerk SDK returns { data: [org1, org2] }
      mockGetOrganizationList.mockResolvedValue({ data: [org1, org2], total_count: 2});

      const result = await service.getTenantList();
      expect(mockGetOrganizationList).toHaveBeenCalledWith({});
      expect(result).toEqual([org1, org2]);
    });

    it('should return an empty list if Clerk returns no organizations', async () => {
      mockGetOrganizationList.mockResolvedValue([]); // Or { data: [] }

      const result = await service.getTenantList();

      expect(mockGetOrganizationList).toHaveBeenCalledWith({});
      expect(result).toEqual([]);
    });

    it('should throw InternalServerErrorException if Clerk client throws an error', async () => {
      const unexpectedError = new Error('Clerk SDK list retrieval failed');
      mockGetOrganizationList.mockRejectedValue(unexpectedError);

      await expect(service.getTenantList()).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockGetOrganizationList).toHaveBeenCalledWith({});
    });
     it('should pass parameters to clerkClient.organizations.getOrganizationList', async () => {
      const params = { limit: 10, offset: 5, includeMembersCount: true };
      mockGetOrganizationList.mockResolvedValue([]); // Return empty for simplicity

      await service.getTenantList(params);

      expect(mockGetOrganizationList).toHaveBeenCalledWith(params);
    });
  });

  // describe('Webhook Handlers', () => { // This was the old top-level wrapper
    // createTenant tests were already updated in Turn 34, reviewing them here.
    // No changes needed for createTenant tests based on current instructions.

    describe('updateTenant (Webhook)', () => {
      const tenantId = 'org_webhook_update_123';
      const initialName = 'Initial Org Name';
      const updatedName = 'Updated Org Name';
      const tenantSlug = 'org-webhook-update';

      const mockUpdateOrgEvent = {
        data: {
          id: tenantId,
          name: updatedName,
          slug: tenantSlug, // Slug might also be updated
          updated_at: new Date().toISOString(),
        },
        type: 'organization.updated'
      } as any;

      it('should update an existing tenant if found locally', async () => {
        const existingLocalTenant = mockLocalTenant(tenantId, initialName, tenantSlug);
        tenantRepository.findOne.mockResolvedValue(existingLocalTenant);
        // Mock save to reflect the update
        tenantRepository.save.mockImplementation(async (tenant) => tenant as Tenant);


        await service.updateTenant(mockUpdateOrgEvent);

        expect(tenantRepository.findOne).toHaveBeenCalledWith({ where: { id: tenantId } });
        expect(tenantRepository.create).not.toHaveBeenCalled(); // Should not create
        expect(tenantRepository.save).toHaveBeenCalledWith(expect.objectContaining({
          id: tenantId,
          name: updatedName,
          slug: tenantSlug,
        }));
      });

      it('should create a new tenant if not found locally (upsert logic)', async () => {
        tenantRepository.findOne.mockResolvedValue(null); // Tenant does not exist
        
        // Spy on createTenant to verify it's called
        const createTenantSpy = jest.spyOn(service, 'createTenant');
        // We don't need to mock create/save for tenantRepository here again if createTenant's own tests are thorough.
        // However, to ensure createTenant is called correctly by updateTenant:
        // tenantRepository.create.mockReturnValueOnce(...); 
        // tenantRepository.save.mockResolvedValueOnce(...);

        await service.updateTenant(mockUpdateOrgEvent);

        expect(tenantRepository.findOne).toHaveBeenCalledWith({ where: { id: tenantId } });
        expect(createTenantSpy).toHaveBeenCalledWith(mockUpdateOrgEvent);
        // Optionally, verify logger message about creating new one
        expect(service['logger'].info).toHaveBeenCalledWith(expect.anything(), 'Tenant not found, creating a new one');
        createTenantSpy.mockRestore(); // Clean up spy
      });
    });

    describe('deleteTenant (Webhook)', () => {
      const tenantId = 'org_webhook_delete_123';
      const mockDeleteOrgEvent = {
        data: { id: tenantId, delete: true }, // Clerk might send 'delete: true' or just the ID
        type: 'organization.deleted'
      } as any;

      it('should delete a tenant if found locally', async () => {
        const existingLocalTenant = mockLocalTenant(tenantId, 'Org To Delete', 'org-to-delete');
        tenantRepository.findOne.mockResolvedValue(existingLocalTenant);
        tenantRepository.delete.mockResolvedValue(undefined); // .delete usually returns void or DeleteResult

        await service.deleteTenant(mockDeleteOrgEvent);

        expect(tenantRepository.findOne).toHaveBeenCalledWith({ where: { id: tenantId } });
        expect(tenantRepository.delete).toHaveBeenCalledWith(tenantId);
      });

      it('should log and return gracefully if tenant not found locally', async () => {
        tenantRepository.findOne.mockResolvedValue(null); // Tenant does not exist

        await service.deleteTenant(mockDeleteOrgEvent);

        expect(tenantRepository.findOne).toHaveBeenCalledWith({ where: { id: tenantId } });
        expect(tenantRepository.delete).not.toHaveBeenCalled();
        // Verify logger was called with warning
        expect(service['logger'].warn).toHaveBeenCalledWith(expect.anything(), 'Tenant not found. Skipping deletion.');
      });
    });
  // }); // End of old top-level Webhook Handlers describe
});
