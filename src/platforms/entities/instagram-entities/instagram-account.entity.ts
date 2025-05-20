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
import { InstagramPost } from './instagram-post.entity';
import { SocialAccount } from '../notifications/entity/social-account.entity';

@Entity('instagram_accounts')
export class InstagramAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: false })
  tenantId: string;

  @OneToOne(() => SocialAccount)
  @JoinColumn()
  socialAccount: SocialAccount;

  @Column({ nullable: true })
  instagramId: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  profilePictureUrl: string;

  @Column({ nullable: true })
  biography: string;

  @Column({ nullable: true })
  facebookPageName: string;

  @Column({ nullable: true })
  facebookPageAccessToken: string;

  @Column({ nullable: true })
  accountType: string;

  @Column({ nullable: true })
  profileUrl: string;

  @Column('jsonb')
  permissions: string[];

  @Column({ default: false })
  isBusinessLogin: boolean; // true for Instagram Business Login, false for Facebook Login

  @Column({ nullable: true })
  facebookPageId: string; // Only applicable for Instagram with Facebook Login

  @Column({ type: 'int', default: 0 })
  followerCount: number;

  @Column({ type: 'int', default: 0 })
  followingCount: number;

  @Column({ type: 'int', default: 0 })
  mediaCount: number;

  @OneToMany(() => InstagramPost, (media) => media.account)
  media: InstagramPost[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column('jsonb')
  metadata: {
    instagramAccounts: {
      id: string;
    }[];
  };
}
