import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';

@Injectable()
export class TenantAwareRepository {
  private TenantId: string = '';

  constructor(protected readonly baseRepository: Repository<any>) { }

  setTenantId(TenantId: string): void {
    this.TenantId = TenantId;
  }

  private withTenant(criteria: any = {}) {
    return this.TenantId
      ? { ...criteria, TenantId: this.TenantId }
      : criteria;
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
