import { OneToOne } from 'typeorm';
import { Tenant } from '../../entities/users/tenant.entity';

export abstract class TenantEntity {
  @OneToOne(() => Tenant, (tenant) => tenant.id)
  tenantId: Tenant;
}
