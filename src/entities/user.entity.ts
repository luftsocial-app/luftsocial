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
} from 'typeorm';
import { GroupMember } from './group.members.entity';
import { Group } from './group.entity';
import { Organization } from './organization.entity';
import { Role } from './role.entity';
import { UserRole, Permission } from '../common/enums/roles';

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

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  profilePicture?: string;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.MEMBER,
  })
  userRole: UserRole;

  @Column({ type: 'jsonb', default: [] })
  permissions: Permission[];

  @OneToMany(() => GroupMember, (groupMember) => groupMember.user)
  groupMembers: GroupMember[];

  @OneToMany(() => Group, (group) => group.createdBy)
  createdGroups: Group[];

  @ManyToMany(() => Role)
  @JoinTable()
  roles: Role[];

  @Column({ type: 'timestamp', nullable: true })
  lastSeen?: Date;

  @Column({ nullable: true })
  status?: string;

  @Column({ nullable: true })
  customStatus?: string;

  // Users can belong to multiple organizations
  @ManyToMany(() => Organization, (organization) => organization.users)
  @JoinTable({
    name: 'user_organizations',
    joinColumn: { name: 'userId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'organizationId', referencedColumnName: 'id' },
  })
  organizations: Organization[];

  // Tracks the currently active organization
  @Column({ nullable: true })
  activeOrganizationId?: string;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  activeOrganization?: Organization;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
