import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationWebhookEvent } from '@clerk/express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { Tenant } from './entities/tenant.entity';

@Injectable()
export class TenantService {
  private tenantId: string;

  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(TenantService.name);
  }

  setTenantId(id: string) {
    this.tenantId = id;
  }

  getTenantId(): string {
    this.logger.info({ tenantId: this.tenantId });

    return this.tenantId;
  }

  async createTenant(createOrgData: OrganizationWebhookEvent): Promise<void> {
    const tenant = this.tenantRepo.create({
      id: createOrgData.data.id,
      name: createOrgData.data['name'],
      slug: createOrgData.data['slug'],
      createdAt: new Date(createOrgData.data['created_at']),
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
    const tenant = await this.tenantRepo.findOne({
      where: { id: deleteOrgData.data.id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    await this.tenantRepo.delete(tenant.id);
  }
}
