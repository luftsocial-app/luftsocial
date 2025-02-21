import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { LinkedInAccount } from './linkedin-account.entity';
import { LinkedInPost } from './linkedin-post.entity';

@Entity('linkedin_organizations')
export class LinkedInOrganization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LinkedInAccount, (account) => account.organizations)
  account: LinkedInAccount;

  @Column()
  organizationId: string;

  @Column()
  name: string;

  @Column()
  vanityName: string;

  @Column()
  description: string;

  @Column('jsonb')
  permissions: string[];

  @OneToMany(() => LinkedInPost, (post) => post.organization)
  posts: LinkedInPost[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
