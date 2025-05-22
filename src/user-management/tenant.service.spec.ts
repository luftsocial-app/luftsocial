import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Tenant } from './entities/tenant.entity';
import { PinoLogger } from 'nestjs-pino';
import { TenantService } from './tenant.service';

describe('TenantService', () => {
  let service: TenantService;
  // let tenantRepository: Repository<Tenant>;
  // let logger: PinoLogger;

  const mockTenant = {
    id: 'tenant123',
    name: 'Test Org',
    slug: 'test-org',
  } as Tenant;

  const mockTenantRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: getRepositoryToken(Tenant), useValue: mockTenantRepo },
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

    service = module.get<TenantService>(TenantService);
    // tenantRepository = module.get(getRepositoryToken(Tenant));
    // logger = module.get<PinoLogger>(PinoLogger);

    jest.clearAllMocks();
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

  describe('createPersonalTenant', () => {
    const mockUserEventData = {
      id: 'user-123',
      first_name: 'John',
      last_name: 'Doe',
      username: 'johndoe',
      email_addresses: [{ email_address: 'john.doe@example.com', id: 'email-id' }],
      primary_email_address_id: 'email-id',
    };

    it('should create a personal tenant with first name', async () => {
      const expectedTenantName = "John's Workspace";
      const expectedSlug = 'johns-workspace';
      mockTenantRepo.create.mockImplementation(dto => ({ ...dto, id: 'new-tenant-uuid' } as Tenant));
      mockTenantRepo.save.mockImplementation(async (tenant: Tenant) => tenant);
      mockTenantRepo.findOne.mockResolvedValue(null); // For slug check

      const result = await service.createPersonalTenant(mockUserEventData as any);

      expect(mockTenantRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        name: expectedTenantName,
        slug: expectedSlug,
      }));
      expect(mockTenantRepo.save).toHaveBeenCalled();
      expect(result.name).toBe(expectedTenantName);
      expect(result.slug).toBe(expectedSlug);
    });

    it('should create a personal tenant with last name if first name is missing', async () => {
      const userData = { ...mockUserEventData, first_name: null };
      const expectedTenantName = "Doe's Workspace";
      const expectedSlug = 'does-workspace';
      mockTenantRepo.create.mockImplementation(dto => ({ ...dto, id: 'new-tenant-uuid' } as Tenant));
      mockTenantRepo.save.mockImplementation(async (tenant: Tenant) => tenant);
      mockTenantRepo.findOne.mockResolvedValue(null);

      const result = await service.createPersonalTenant(userData as any);
      expect(result.name).toBe(expectedTenantName);
      expect(result.slug).toBe(expectedSlug);
    });

    it('should create a personal tenant with username if first and last names are missing', async () => {
      const userData = { ...mockUserEventData, first_name: null, last_name: null };
      const expectedTenantName = "johndoe's Workspace";
      const expectedSlug = 'johndoes-workspace';
      mockTenantRepo.create.mockImplementation(dto => ({ ...dto, id: 'new-tenant-uuid' } as Tenant));
      mockTenantRepo.save.mockImplementation(async (tenant: Tenant) => tenant);
      mockTenantRepo.findOne.mockResolvedValue(null);

      const result = await service.createPersonalTenant(userData as any);
      expect(result.name).toBe(expectedTenantName);
      expect(result.slug).toBe(expectedSlug);
    });
    
    it('should create a personal tenant with default name if all name parts are missing', async () => {
        const userData = { ...mockUserEventData, first_name: null, last_name: null, username: null };
        const expectedTenantName = "Personal Workspace";
        const expectedSlug = 'personal-workspace';
        mockTenantRepo.create.mockImplementation(dto => ({ ...dto, id: 'new-tenant-uuid' } as Tenant));
        mockTenantRepo.save.mockImplementation(async (tenant: Tenant) => tenant);
        mockTenantRepo.findOne.mockResolvedValue(null);
  
        const result = await service.createPersonalTenant(userData as any);
        expect(result.name).toBe(expectedTenantName);
        expect(result.slug).toBe(expectedSlug);
      });

    it('should ensure slug uniqueness by appending a timestamp if initial slug exists', async () => {
      const expectedInitialSlug = 'johns-workspace';
      const existingTenantWithSlug = { id: 'existing-tenant-uuid', name: "John's Workspace", slug: expectedInitialSlug } as Tenant;
      
      mockTenantRepo.create.mockImplementation(dto => ({ ...dto, id: 'new-tenant-uuid' } as Tenant));
      mockTenantRepo.save.mockImplementation(async (tenant: Tenant) => tenant);
      // First call to findOne (slug check) returns an existing tenant
      mockTenantRepo.findOne.mockResolvedValueOnce(existingTenantWithSlug); 
      // Second call to findOne (if any, for other reasons, should be null for this test flow)
      mockTenantRepo.findOne.mockResolvedValueOnce(null);


      const result = await service.createPersonalTenant(mockUserEventData as any);
      
      expect(mockTenantRepo.findOne).toHaveBeenCalledWith({ where: { slug: expectedInitialSlug } });
      expect(result.slug).toMatch(new RegExp(`^${expectedInitialSlug}-[0-9]+$`));
      expect(mockTenantRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if save fails', async () => {
      mockTenantRepo.create.mockImplementation(dto => ({ ...dto } as Tenant));
      mockTenantRepo.save.mockRejectedValue(new Error('Database save error'));
      mockTenantRepo.findOne.mockResolvedValue(null);

      await expect(service.createPersonalTenant(mockUserEventData as any)).rejects.toThrow('Could not create personal tenant.');
    });
    
    it('should truncate long tenant names and slugs', async () => {
        const longNamePart = 'a'.repeat(300);
        const userData = { ...mockUserEventData, first_name: longNamePart };
        // Expected: "aaaaaaaa...(252 chars)...'s Workspace"
        const expectedTenantNameStart = longNamePart.substring(0, 252) + "..."; 
        // Expected slug: "aaaaaaaa...(255 chars)"
        const expectedSlugStart = (expectedTenantNameStart + "s-workspace").toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0,255);

        mockTenantRepo.create.mockImplementation(dto => ({ ...dto, id: 'new-tenant-uuid' } as Tenant));
        mockTenantRepo.save.mockImplementation(async (tenant: Tenant) => tenant);
        mockTenantRepo.findOne.mockResolvedValue(null);

        const result = await service.createPersonalTenant(userData as any);
        
        expect(result.name.startsWith(expectedTenantNameStart)).toBe(true);
        expect(result.name.length).toBeLessThanOrEqual(255 + "'s Workspace".length); // Max length of first part + suffix
        expect(result.slug.length).toBeLessThanOrEqual(255);
        expect(result.slug.startsWith(expectedSlugStart.substring(0,200))).toBe(true); // check a good portion of the start
    });

  });
});
