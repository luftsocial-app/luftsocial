import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('tbl_organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  slug?: string;

  @Column({ nullable: true })
  logo?: string;

  @Column({ type: 'jsonb', default: {} })
  settings: {
    maxUsers: number;
    features: string[];
  };

  // Many users can belong to this organization
  @ManyToMany(() => User, (user) => user.organizations)
  users: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
