import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GroupMember } from './groupMembers.entity';
import { User } from './user.entity';
import { Message } from './message.entity';
// import { Organization } from './Organization';

@Entity()
export class Group {
  @PrimaryGeneratedColumn()
  id: number; // modified from 'uuid' and type string to number

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  //   @ManyToOne(() => Organization, (organization) => organization.groups)
  //   organization: Organization;

  @OneToMany(() => GroupMember, (groupMember) => groupMember.group)
  members: GroupMember[];

  @Column({ type: 'boolean', default: true })
  status: boolean;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.createdGroups)
  @JoinColumn({ name: 'createdBy' })
  user: User;

  @Column({ nullable: true })
  createdBy: number;

  @OneToMany(() => Message, (message) => message.group)
  messages: Message[];

  @Column()
  tenantId: string
}
