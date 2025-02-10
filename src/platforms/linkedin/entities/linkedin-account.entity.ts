import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { LinkedInOrganization } from './linkedin-organization.entity';
import { SocialAccount } from 'src/platforms/entity/social-account.entity';

@Entity('linkedin_accounts')
export class LinkedInAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => SocialAccount)
  @JoinColumn()
  socialAccount: SocialAccount;

  @Column()
  linkedinUserId: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  profileUrl: string;

  @Column('jsonb')
  permissions: string[];

  @OneToMany(() => LinkedInOrganization, (org) => org.account)
  organizations: LinkedInOrganization[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column('jsonb', { nullable: true })
  metadata: {
    organizations: Array<{
      id: string;
      name: string;
    }>;
  };
}
