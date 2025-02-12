import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Column,
} from 'typeorm';
import { Group } from './group.entity';
import { User } from './user.entity'; // Assuming you already have a User entity
import { GroupRole } from '../common/enums/roles';

@Entity()
export class GroupMember {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Group, (group) => group.members)
  @JoinColumn({ name: 'groupId' })
  group: Group;

  @Column()
  groupId: number;

  @ManyToOne(() => User, (user) => user.groupMembers)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean; // Marks if the member is active in the group

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  joinedAt: Date;

  @Column({
    type: 'enum',
    enum: GroupRole,
    default: GroupRole.MEMBER,
  })
  role: GroupRole;

  // @DeleteDateColumn({ nullable: true })
  // deletedAt: Date; // Soft delete

  @Column({ type: 'boolean', default: true })
  status: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @Column()
  tenantId: string;
}
