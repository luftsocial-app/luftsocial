import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Message } from './message.entity';
import { GroupMember } from './groupMembers.entity';
import { Group } from './group.entity';
// import { Notification } from './notification.entity'

@Entity({ name: 'tbl_users' })
export class Users {
  @PrimaryColumn({ name: 'id', nullable: false })
  id: number;

  @Column({ name: 'user_name', nullable: false })
  username: string;

  @Column({ name: 'first_name', nullable: true })
  firstName: string;

  @Column({ name: 'last_name', nullable: true })
  lastName: string;

  @Column({ name: 'email', nullable: false })
  email: string;

  @Column({ name: 'phone_number', nullable: true })
  phoneNumber: string;

  @Column({ name: 'password', nullable: true })
  password: string;

  @Column({ name: 'is_active', default: true, nullable: true })
  isActive: boolean;

  @Column({ name: 'created_at', nullable: true })
  createdAt: Date;

  @Column({ name: 'updated_at', nullable: true })
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

  @Column({ name: 'profile_picture', nullable: true })
  profilePicture: string;

  @OneToMany(() => Message, (message) => message.sender)
  sentMessages: Message[];

  @OneToMany(() => Message, (message) => message.receiver)
  receivedMessages: Message[];

  @OneToMany(() => GroupMember, (groupMember) => groupMember.user)
  groupMembers: GroupMember[];

  @OneToMany(() => Group, (group) => group.createdBy)
  createdGroups: Group[];

  // @OneToMany(() => Notification, (notification) => notification.user)
  // notifications: Notification[];
}
