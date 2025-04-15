import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';

@Injectable()
export class TenantAwareRepository {
  private tenantId: string = '';

  constructor(protected readonly baseRepository: Repository<any>) {}

  setTenantId(tenantId: string): void {
    this.tenantId = tenantId;
  }

  getTenantId(): string {
    return this.tenantId;
  }

  private withTenant(criteria: any = {}) {
    return this.tenantId ? { ...criteria, tenantId: this.tenantId } : criteria;
  }

  find(options: any = {}) {
    options.where = this.withTenant(options.where);
    return this.baseRepository.find(options);
  }

  findOne(options: any = {}) {
    options.where = this.withTenant(options.where);
    return this.baseRepository.findOne(options);
  }

  create(data: any) {
    return this.baseRepository.create(data);
  }

  save(data: any) {
    return this.baseRepository.save(data);
  }

  delete(criteria: any) {
    return this.baseRepository.delete(this.withTenant(criteria));
  }
}
