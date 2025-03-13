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
import { TenantEntity } from '../../notifications/entity/tenant-entity';
import { SocialAccount } from '../../notifications/entity/social-account.entity';

@Entity('tiktok_accounts')
export class TikTokAccount extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => SocialAccount)
  @JoinColumn()
  socialAccount: SocialAccount;

  @Column()
  tiktokUserId: string;

  @Column()
  username: string;

  @Column({ nullable: true })
  displayName: string;

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
