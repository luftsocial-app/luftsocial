import {
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Tenant } from './tenant.entity';

@Entity({ name: 'tbl_user_tenants' })
export class UserTenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.userTenants, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Tenant, (tenant) => tenant.userTenants, {
    onDelete: 'CASCADE',
  })
  tenant: Tenant;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
