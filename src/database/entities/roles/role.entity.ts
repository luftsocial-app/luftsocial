import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Permissions } from './permissions.entity';
import { UserRole } from '../../../common/enums/roles';

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

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Permissions, (permission) => permission.id)
  @JoinColumn({ name: 'permissions' })
  permissions: Permissions[];
}
