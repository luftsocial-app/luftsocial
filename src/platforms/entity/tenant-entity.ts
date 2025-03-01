import { Column } from 'typeorm';

export abstract class TenantEntity {
  @Column()
  tenantId: string;
}
