import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { User } from './user.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  logo?: string;

  @Column({ type: 'jsonb', default: {} })
  settings: {
    maxUsers: number;
    features: string[];
  };

  @OneToMany(() => User, (user) => user.organization)
  users: User[];
}
