import {
  Entity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  OneToMany,
  JoinColumn,
  PrimaryColumn,
} from 'typeorm';
import { Team } from './team.entity';
import { UserTenant } from './user-tenant.entity';

@Entity('tbl_tenants')
export class Tenant {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'name', unique: true })
  name: string;

  @Column({ name: 'slug', unique: true, nullable: true })
  slug?: string;

  @Column({ name: 'logo', nullable: true })
  logo?: string;

  @OneToMany(() => UserTenant, (userTenant) => userTenant.tenant, {
    cascade: true,
  })
  @JoinColumn({ name: 'tenant_users' })
  userTenants: UserTenant[];

  @OneToMany(() => Team, (team) => team.tenantId, { cascade: true })
  teams: Team[];

  @Column({ name: 'settings', type: 'jsonb', default: {} })
  settings: {
    maxUsers: number;
    features: string[];
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
