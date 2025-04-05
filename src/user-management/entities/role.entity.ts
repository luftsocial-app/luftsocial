import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  JoinColumn,
  ManyToMany,
  ManyToOne,
} from 'typeorm';
import { Permissions } from './permissions.entity';
import { UserRole } from '../../common/enums/roles';
import { Tenant } from './tenant.entity';
import { User } from './user.entity';

@Entity({ name: 'tbl_role' })
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.MEMBER,
  })
  name: UserRole;

  // Role is specific to a tenant
  @ManyToOne(() => Tenant, (tenant) => tenant.roles)
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;

  // Many-to-Many relationship with users
  @ManyToMany(() => User, (user) => user.roles)
  users?: User[];

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Permissions, (permission) => permission.id)
  @JoinColumn({ name: 'permissions' })
  permissions: Permissions[];
}
