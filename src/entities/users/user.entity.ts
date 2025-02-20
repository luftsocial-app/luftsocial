import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { Role } from '../roles/role.entity';
import { Permission } from '../../common/enums/roles';
import { Team } from './team.entity';
import { UserTenant } from './user-tenant.entity';

@Entity({ name: 'tbl_users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  clerkId: string;

  @Column({ unique: true })
  email: string;

  @Column()
  username: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ name: 'profile', nullable: true })
  profilePicture?: string;

  @Column({ name: 'phone', nullable: true })
  phoneNumber?: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: [] })
  permissions: Permission[];

  @OneToMany(() => Team, (team) => team.createdBy)
  @JoinColumn({ name: 'user_created_groups' })
  createdTeams: Team[];

  @ManyToMany(() => Role, (role) => role.id)
  @JoinTable({
    name: 'tbl_user_roles',
    joinColumn: {
      name: 'role_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'user_id',
      referencedColumnName: 'id',
    },
  })
  roles: Role[];

  @Column({ type: 'timestamp', nullable: true })
  lastSeen?: Date;

  @Column({ nullable: true })
  status?: string;

  @Column({ nullable: true })
  customStatus?: string;

  // User belongs to multiple tenants
  @OneToMany(() => UserTenant, (userTenant) => userTenant.user, {
    cascade: true,
  })
  userTenants: UserTenant[];

  // User belongs to multiple teams
  @ManyToMany(() => Team, (team) => team.users)
  teams: Team[];

  // Tracks the currently active Tenant
  @Column({ nullable: true })
  activeTenantId?: string;

  @ManyToOne(() => Tenant, { nullable: true, onDelete: 'SET NULL' })
  activeTenant?: Tenant;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
