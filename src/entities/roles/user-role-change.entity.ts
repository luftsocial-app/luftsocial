import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { UserRole } from '../../common/enums/roles';

@Entity({ name: 'tbl_user_role_change' })
export class UserRoleChange {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: string;
  @Column('uuid')
  userId: string;

  @Column('uuid')
  changedById: string;

  @Column()
  previousRole: UserRole;

  @Column({ name: 'new_role' })
  newRole: UserRole;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason?: string;
}
