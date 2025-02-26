import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { TikTokAccount } from '../tiktok/entities/tiktok-account.entity';
import { FacebookAccount } from '../facebook/entity/facebook-account.entity';
import { InstagramAccount } from '../instagram/entities/instagram-account.entity';
import { LinkedInAccount } from '../linkedin/entities/linkedin-account.entity';
import { TenantEntity } from './tenant-entity';
import { SocialPlatform } from 'src/enum/social-platform.enum';

@Entity('social_accounts')
export class SocialAccount extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: SocialPlatform })
  platform: SocialPlatform;

  @Column()
  platformUserId: string;

  @Column()
  accessToken: string;

  @Column({ nullable: true })
  refreshToken: string;

  @Column({ type: 'timestamp' })
  tokenExpiresAt: Date;

  @Column('jsonb', { nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => FacebookAccount, (account) => account.socialAccount, {
    onDelete: 'CASCADE',
  })
  facebookAccount: FacebookAccount;

  @OneToOne(() => InstagramAccount, (account) => account.socialAccount, {
    onDelete: 'CASCADE',
  })
  instagramAccount: InstagramAccount;

  @OneToOne(() => LinkedInAccount, (account) => account.socialAccount, {
    onDelete: 'CASCADE',
  })
  linkedInAccount: LinkedInAccount;

  @OneToOne(() => TikTokAccount, (account) => account.socialAccount, {
    onDelete: 'CASCADE',
  })
  tiktokAccount: TikTokAccount;
}
