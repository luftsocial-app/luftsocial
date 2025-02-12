import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Permissions } from './permissions.entity';
import { User } from './user.entity';
import { UserRole } from '../common/enums/roles';

@Entity()
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.MEMBER,
  })
  name: UserRole;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToMany(() => Permissions)
  @JoinTable()
  permissions: Permissions[];

  @ManyToMany(() => User, (user) => user.roles)
  users: User[];
}
