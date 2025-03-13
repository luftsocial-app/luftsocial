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
import { SocialAccount } from '../../notifications/entity/social-account.entity';
import { TenantEntity } from '../../notifications/entity/tenant-entity';

@Entity('instagram_accounts')
export class InstagramAccount extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => SocialAccount)
  @JoinColumn()
  socialAccount: SocialAccount;

  @Column()
  instagramAccountId: string;

  @Column()
  username: string;

  @Column({ nullable: true })
  profileUrl: string;

  @Column('jsonb')
  permissions: string[];

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
