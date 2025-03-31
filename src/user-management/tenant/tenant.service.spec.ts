import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TenantService } from './tenant.service';
import { NotFoundException } from '@nestjs/common';
import { Tenant } from '../entities/tenant.entity';
import { PinoLogger } from 'nestjs-pino';

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

        await service.handleTenantCreation(mockWebhookData as any);

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

        await service.handleTenantDeletion(mockWebhookData as any);

        expect(mockTenantRepo.delete).toHaveBeenCalledWith('tenant123');
      });

      it('should throw if tenant not found', async () => {
        mockTenantRepo.findOne.mockResolvedValue(null);

        await expect(
          service.handleTenantDeletion(mockWebhookData as any),
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

        await service.handleTenantUpdate(mockWebhookData as any);

        expect(mockTenantRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Updated Org' }),
        );
      });

      it('should throw if tenant not found', async () => {
        mockTenantRepo.findOne.mockResolvedValue(null);

        await expect(
          service.handleTenantUpdate(mockWebhookData as any),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  // ... existing tests for core tenant functionality ...
});
