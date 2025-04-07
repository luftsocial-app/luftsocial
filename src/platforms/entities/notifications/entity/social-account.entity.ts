import { SocialPlatform } from '../../../../common/enums/social-platform.enum';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { FacebookAccount } from '../../facebook-entities/facebook-account.entity';

@Entity('social_accounts')
export class SocialAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  tenantId: string;

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
