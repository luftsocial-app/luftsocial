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
import { InstagramMedia } from './instagram-media.entity';
import { SocialAccount } from 'src/platforms/entity/social-account.entity';

@Entity('instagram_accounts')
export class InstagramAccount {
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

  @OneToMany(() => InstagramMedia, (media) => media.account)
  media: InstagramMedia[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column()
  accessToken: string;

  @Column('jsonb')
  metadata: {
    instagramAccounts: {
      id: string;
    }[];
  };
}
