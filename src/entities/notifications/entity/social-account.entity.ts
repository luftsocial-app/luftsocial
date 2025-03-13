import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';

import { TenantEntity } from './tenant-entity';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import { FacebookAccount } from '../../socials/facebook-entities/facebook-account.entity';


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
  facebookAccount?: FacebookAccount;
}
