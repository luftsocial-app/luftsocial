import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { Role } from '../roles/role.entity';
import { Permission } from '../../common/enums/roles';
import { UserTenant } from './user-tenant.entity';
import { MessageEntity } from '../../messaging/messages/entities/message.entity';
import { Team } from './team.entity';
import { ConversationEntity } from '../../messaging/conversations/entities/conversation.entity';

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

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: string;

  @Column({ name: 'is_deleted', default: true })
  isDeleted: boolean;

  @Column({ name: 'deleted_at', nullable: true })
  deletedAt: Date;

  @Column({ name: 'deleted_by', nullable: true })
  deletedBy: string;

  @OneToMany(() =>  MessageEntity, (message) => message.sender)
  sentMessages: MessageEntity[];

  @ManyToMany(() => ConversationEntity, (conversation) => conversation.participants)
  conversations: ConversationEntity[];
}
