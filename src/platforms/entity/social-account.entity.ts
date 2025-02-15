import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SocialPlatform } from 'src/enum/social-platform.enum';

@Entity('social_accounts')
export class SocialAccount {
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
}
