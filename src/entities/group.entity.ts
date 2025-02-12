import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GroupMember } from './group.members.entity';
import { User } from './user.entity';

@Entity()
export class Group {
  @PrimaryGeneratedColumn()
  id: string; // modified from 'uuid' and type string to number

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
  createdBy: string;

  @Column()
  tenantId: string;
}
