import { Column } from 'typeorm';

export abstract class TenantEntity {
  @Column({ nullable: false })
  tenantId: string;
}
