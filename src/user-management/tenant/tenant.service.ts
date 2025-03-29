import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTenantDto, UpdateTenantDto } from './dto/TenantDto';
import { OrganizationWebhookEvent } from '@clerk/express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';

@Injectable()
export class TenantService {
  private tenantId: string;

  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
  ) {}

  setTenantId(id: string) {
    this.tenantId = id;
  }

  getTenantId(): string {
    console.log({ tenantId: this.tenantId });

    return this.tenantId;
  }

  createTenant(createOrgData: OrganizationWebhookEvent): void {
    // save organization to tenant table
    const tenant = this.tenantRepo.create({
      id: createOrgData.data.id,
      name: createOrgData.data['name'],
      createdAt: new Date(createOrgData.data['created_at']),
    });

    this.tenantRepo
      .save(tenant)
      .then(() => {
        console.log('Tenant saved successfully');
      })
      .catch((error) => {
        console.error('Error saving tenant:', error);
        throw new Error('Failed to save tenant');
      });
  }

  async handleTenantCreation(
    createOrgData: OrganizationWebhookEvent,
  ): Promise<void> {
    const tenant = this.tenantRepo.create({
      id: createOrgData.data.id,
      name: createOrgData.data['name'],
      slug: createOrgData.data['slug'],
      createdAt: new Date(createOrgData.data['created_at']),
    });

    await this.tenantRepo.save(tenant);
  }

  async handleTenantUpdate(
    updateOrgData: OrganizationWebhookEvent,
  ): Promise<void> {
    const tenant = await this.tenantRepo.findOne({
      where: { id: updateOrgData.data.id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    tenant.name = updateOrgData.data['name'];
    tenant.updatedAt = new Date(updateOrgData.data['updated_at']);
    await this.tenantRepo.save(tenant);
  }

  async handleTenantDeletion(
    deleteOrgData: OrganizationWebhookEvent,
  ): Promise<void> {
    const tenant = await this.tenantRepo.findOne({
      where: { id: deleteOrgData.data.id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    await this.tenantRepo.delete(tenant.id);
  }

  updateTodo(uuid: string, data: UpdateTenantDto): void {}

  delete(uuid: string): void {}

  getTenant(id: string): void {}

  createTodo(data: CreateTenantDto): void {}
}
