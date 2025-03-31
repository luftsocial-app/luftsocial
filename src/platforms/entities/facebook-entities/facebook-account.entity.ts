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
import { FacebookPage } from './facebook-page.entity';
import { SocialAccount } from '../notifications/entity/social-account.entity';

@Entity('facebook_accounts')
export class FacebookAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  tenantId: string;

  @OneToOne(() => SocialAccount)
  @JoinColumn()
  socialAccount: SocialAccount;

  @Column()
  userId: string;

  @Column()
  facebookUserId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  profileUrl: string;

  @Column('jsonb', { nullable: true })
  permissions: string[];

  @OneToMany(() => FacebookPage, (page) => page.facebookAccount)
  pages: FacebookPage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
