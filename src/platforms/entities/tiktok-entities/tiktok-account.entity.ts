import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { TikTokVideo } from './tiktok-video.entity';
import { SocialAccount } from '../notifications/entity/social-account.entity';

@Entity('tiktok_accounts')
export class TikTokAccount {
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
  openId: string;

  @Column({ nullable: true })
  displayName: string;

  @Column({ nullable: true })
  bioDescription: string;

  @Column({ nullable: true })
  avatarLargeUrl: string;

  @Column({ nullable: true })
  avatarUrl100: string;

  @Column({ nullable: true })
  profileDeepLink: string;

  @Column({ type: 'int', default: 0 })
  followerCount: number;

  @Column({ type: 'int', default: 0 })
  followingCount: number;

  @Column({ type: 'int', default: 0 })
  likesCount: number;

  @Column({ type: 'int', default: 0 })
  videoCount: number;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ default: false })
  isVerified: boolean;

  @OneToMany(() => TikTokVideo, (video) => video.account)
  videos: TikTokVideo[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
