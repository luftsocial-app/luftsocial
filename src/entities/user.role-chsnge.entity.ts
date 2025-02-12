import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { UserRole } from '../common/enums/roles';

@Entity()
export class UserRoleChange {
  @PrimaryGeneratedColumn({ type: 'number' })
  id: string;
  @Column('uuid')
  userId: string;

  @Column('uuid')
  changedById: string;

  @Column()
  previousRole: UserRole;

  @Column()
  newRole: UserRole;

  @Column({ type: 'text', nullable: true })
  reason?: string;
}
