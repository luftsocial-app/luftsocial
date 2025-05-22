import {
  Injectable,
  NotFoundException,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  OrganizationWebhookEvent,
  ClerkClient, // Adjusted import
} from '@clerk/express'; // Keep @clerk/express for WebhookEvent if not found in backend
import {
  Organization,
  GetOrganizationListParams,
} from '@clerk/backend'; // For Clerk entities
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { Tenant } from './entities/tenant.entity';
import { CLERK_CLIENT } from '../../clerk/clerk.provider';

@Injectable()
export class TenantService {
  private tenantId: string;

  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    private readonly logger: PinoLogger,
    @Inject(CLERK_CLIENT) private readonly clerkClient: ClerkClient,
  ) {
    this.logger.setContext(TenantService.name);
  }

  // Method to get tenant by ID from Clerk
  async getTenantById(tenantId: string): Promise<Organization | null> {
    this.logger.info({ tenantId }, 'Fetching tenant by ID from Clerk');
    try {
      const organization =
        await this.clerkClient.organizations.getOrganization({
          organizationId: tenantId,
        });
      return organization;
    } catch (error) {
      // Clerk errors often have a status property or are structured with a .errors array
      // Adjust this based on how clerk-sdk-node throws errors
      if (error.status === 404 || (error.errors && error.errors[0]?.code === 'organization_not_found')) {
        this.logger.warn({ tenantId, error }, 'Tenant not found in Clerk');
        throw new NotFoundException(`Tenant with ID ${tenantId} not found.`);
      }
      this.logger.error({ tenantId, error }, 'Error fetching tenant from Clerk');
      throw new InternalServerErrorException(
        `Error fetching tenant from Clerk: ${error.message}`,
      );
    }
  }

  // Method to get a list of tenants from Clerk
  async getTenantList(
    params: GetOrganizationListParams = {},
  ): Promise<Organization[]> {
    this.logger.info({ params }, 'Fetching tenant list from Clerk');
    try {
      // Assuming getOrganizationList directly returns the list or an object with a data property
      // Adjust if the actual SDK returns a paginated object like { data: [], total_count: X }
      const response =
        await this.clerkClient.organizations.getOrganizationList(params);
      // If response is an array, return directly. If it's an object with data property:
      return Array.isArray(response) ? response : response.data;
    } catch (error) {
      this.logger.error({ params, error }, 'Error fetching tenant list from Clerk');
      throw new InternalServerErrorException(
        `Error fetching tenant list from Clerk: ${error.message}`,
      );
    }
  }

  setTenantId(id: string) {
    this.tenantId = id;
  }

  getTenantId(): string {
    this.logger.info({ tenantId: this.tenantId });

    return this.tenantId;
  }

  async createTenant(createOrgData: OrganizationWebhookEvent): Promise<void> {
    const tenantId = createOrgData.data.id;
    this.logger.info({ tenantId }, 'Processing createTenant event');

    const existingTenant = await this.tenantRepo.findOne({
      where: { id: tenantId },
    });

    if (existingTenant) {
      this.logger.info(
        { tenantId },
        'Tenant already exists. Skipping creation.',
      );
      return;
    }

    this.logger.info({ tenantId }, 'Creating new tenant in DB');
    const tenant = this.tenantRepo.create({
      id: tenantId,
      name: createOrgData.data.name, // Use .name directly
      slug: createOrgData.data.slug, // Use .slug directly
      createdAt: new Date(createOrgData.data.created_at), // Use .created_at
    });

    await this.tenantRepo.save(tenant);
  }

  async updateTenant(updateOrgData: OrganizationWebhookEvent): Promise<void> {
    const tenant = await this.tenantRepo.findOne({
      where: { id: updateOrgData.data.id },
    });

    // create a new tenant if it doesn't exist
    if (!tenant) {
      this.logger.info('Tenant not found, creating a new one');
      this.createTenant(updateOrgData);
      return;
    }

    tenant.name = updateOrgData.data['name'];
    tenant.slug = updateOrgData.data['slug'];
    tenant.updatedAt = new Date(updateOrgData.data['updated_at']);
    await this.tenantRepo.save(tenant);
  }

  async deleteTenant(deleteOrgData: OrganizationWebhookEvent): Promise<void> {
    const tenantId = deleteOrgData.data.id;
    this.logger.info({ tenantId }, 'Processing deleteTenant event');

    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId },
    });

    if (!tenant) {
      this.logger.warn(
        { tenantId },
        'Tenant not found. Skipping deletion.',
      );
      return;
    }

    this.logger.info({ tenantId }, 'Deleting tenant from DB');
    await this.tenantRepo.delete(tenant.id);
  }
}
