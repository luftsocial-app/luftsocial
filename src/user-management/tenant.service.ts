import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import {
  OrganizationWebhookEvent,
  ClerkClient,
  Organization,
} from '@clerk/backend'; // Added Organization
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { Tenant } from './entities/tenant.entity';
import { CLERK_CLIENT } from '../clerk/clerk.provider'; // Added CLERK_CLIENT import

@Injectable()
export class TenantService {
  private tenantId: string;

  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    private readonly logger: PinoLogger,
    @Inject(CLERK_CLIENT) private readonly clerkClient: ClerkClient, // Injected ClerkClient
  ) {
    this.logger.setContext(TenantService.name);
  }

  async getTenantById(tenantId: string): Promise<Organization> {
    try {
      const organization = await this.clerkClient.organizations.getOrganization(
        { organizationId: tenantId },
      );
      if (!organization) {
        // Clerk SDK might throw an error for not found, or return null/undefined.
        // Assuming it throws, the catch block will handle it.
        // If it returns null/undefined, this check is useful.
        throw new NotFoundException(
          `Tenant with ID ${tenantId} not found in Clerk.`,
        );
      }
      return organization;
    } catch (error) {
      this.logger.error(
        { error, tenantId },
        'Error fetching tenant from Clerk by ID',
      );
      // Clerk errors often have a status or a more specific code in error.errors
      // Example: error.errors[0].code === 'organization_not_found'
      // For now, let's check for a 404 status or rethrow a generic not found.
      if (
        error.status === 404 ||
        (error.errors && error.errors[0]?.code === 'resource_not_found')
      ) {
        throw new NotFoundException(
          `Tenant with ID ${tenantId} not found in Clerk.`,
        );
      }
      // Rethrow other errors or wrap them
      throw new Error(
        `Failed to fetch tenant from Clerk: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async getAllTenants(): Promise<Organization[]> {
    try {
      // The getOrganizationList method might accept parameters for pagination, filtering, etc.
      // For now, using default call to get all organizations.
      const organizations =
        await this.clerkClient.organizations.getOrganizationList();
      return organizations.data; // Clerk's getOrganizationList returns a response object with a 'data' array
    } catch (error) {
      this.logger.error({ error }, 'Error fetching all tenants from Clerk');
      // Handle potential errors, e.g., if the API key doesn't have permission or network issues
      throw new Error(
        `Failed to fetch all tenants from Clerk: ${error.message || 'Unknown error'}`,
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
      this.logger.warn({ tenantId }, 'Tenant not found. Skipping deletion.');
      return;
    }

    this.logger.info({ tenantId }, 'Deleting tenant from DB');
    await this.tenantRepo.delete(tenant.id);
  }

  async createPersonalTenant(
    userEventData: UserWebhookEvent['data'],
  ): Promise<Tenant> {
    this.logger.info(
      { userId: userEventData.id },
      'Creating personal tenant for user',
    );
    let tenantName = 'Personal Workspace'; // Default name
    if (userEventData.first_name) {
      tenantName = `${userEventData.first_name}'s Workspace`;
    } else if (userEventData.last_name) {
      tenantName = `${userEventData.last_name}'s Workspace`;
    } else if (userEventData.username) {
      tenantName = `${userEventData.username}'s Workspace`;
    }

    // Ensure tenantName is not excessively long
    if (tenantName.length > 255) {
      tenantName = tenantName.substring(0, 252) + '...';
    }

    // Generate a slug (basic version, consider a more robust slugification library if needed)
    let slug = tenantName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    if (slug.length > 255) {
      slug = slug.substring(0, 255);
    }
    // Ensure slug is unique (this is a simplified check, a real implementation might need a loop and DB check)
    const existingTenantWithSlug = await this.tenantRepo.findOne({ where: { slug } });
    if (existingTenantWithSlug) {
        slug = `${slug}-${Date.now()}`; // Append timestamp to ensure uniqueness
        if (slug.length > 255) {
            slug = slug.substring(0, 255);
        }
    }


    const newTenant = this.tenantRepo.create({
      name: tenantName,
      slug: slug,
      // Set other default properties for a personal tenant as needed
      // For example, maxUsers: 1, or specific feature flags.
      // For now, we'll rely on database defaults or nullable fields.
      // id will be auto-generated by the database (UUID)
    });

    try {
      const savedTenant = await this.tenantRepo.save(newTenant);
      this.logger.info(
        { tenantId: savedTenant.id, userId: userEventData.id },
        'Personal tenant created successfully',
      );
      return savedTenant;
    } catch (error) {
      this.logger.error(
        { error, userId: userEventData.id },
        'Error creating personal tenant',
      );
      throw new BadRequestException('Could not create personal tenant.');
    }
  }
}
