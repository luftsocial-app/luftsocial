import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Tenant } from './tenant.entity'; // Import Tenant entity

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @ManyToMany(() => User, (user) => user.teams)
  @JoinTable({
    name: 'team_members', // table name for the junction table
    joinColumn: { name: 'team_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  users: User[];

  // Relation to Tenant
  @ManyToOne(() => Tenant, (tenant) => tenant.teams, { nullable: false }) // Assuming a team must belong to a tenant
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  // Relation to User for createdBy
  @ManyToOne(() => User, { nullable: true }) // Nullable if creator can be system or undefined
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy?: User;

  @Column({ name: 'updated_by_user_id', type: 'uuid', nullable: true }) // Keep as string ID, or relate to User as well
  updatedBy?: string; // Or User entity if you want full relation
}
