import {
  Entity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  OneToMany,
  PrimaryColumn,
  ManyToMany,
} from 'typeorm';
import { Team } from './team.entity';
import { User } from './user.entity';
import { Role } from './role.entity';
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

  @ManyToMany(() => User, (user) => user.tenants)
  users: User[];

  // One-to-Many relationship with roles (tenant can have many roles)
  @OneToMany(() => Role, (role) => role.tenant)
  roles: Role[];

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
