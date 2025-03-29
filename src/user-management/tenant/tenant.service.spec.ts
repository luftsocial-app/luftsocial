import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantService } from './tenant.service';
import { Tenant } from '../../entities/users/tenant.entity';

describe('TenantService', () => {
  let service: TenantService;
  let tenantRepository: Repository<Tenant>;

  const mockTenantRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository,
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
    tenantRepository = module.get<Repository<Tenant>>(getRepositoryToken(Tenant));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleTenantCreation', () => {
    it('should create a new tenant from webhook data', async () => {
      const mockWebhookData = {
        data: {
          id: 'test-id',
          name: 'Test Org',
          slug: 'test-org',
          created_at: '2023-01-01T00:00:00Z',
        },
      };

      const expectedTenant = {
        id: 'test-id',
        name: 'Test Org',
        slug: 'test-org',
        createdAt: new Date('2023-01-01T00:00:00Z'),
      };

      mockTenantRepository.create.mockReturnValue(expectedTenant);
      mockTenantRepository.save.mockResolvedValue(expectedTenant);

      await service.handleTenantCreation(mockWebhookData as any);
      expect(mockTenantRepository.save).toHaveBeenCalledWith(expectedTenant);
    });
  });

  describe('handleTenantDeletion', () => {
    it('should delete tenant when organization is deleted', async () => {
      const mockWebhookData = {
        data: {
          id: 'test-id',
        },
      };

      const mockTenant = { id: 'test-id' };
      mockTenantRepository.findOne.mockResolvedValue(mockTenant);

      await service.handleTenantDeletion(mockWebhookData as any);
      expect(mockTenantRepository.delete).toHaveBeenCalledWith('test-id');
    });

    it('should throw error if tenant not found', async () => {
      const mockWebhookData = {
        data: {
          id: 'non-existent',
        },
      };

      mockTenantRepository.findOne.mockResolvedValue(null);

      await expect(
        service.handleTenantDeletion(mockWebhookData as any),
      ).rejects.toThrow('Tenant not found');
    });
  });
});
