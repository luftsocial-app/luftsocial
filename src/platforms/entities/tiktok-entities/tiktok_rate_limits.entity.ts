import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { TikTokAccount } from './tiktok-account.entity';

@Entity('tiktok_rate_limits')
export class TikTokRateLimit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TikTokAccount)
  account: TikTokAccount;

  @Column()
  action: string;

  @CreateDateColumn()
  createdAt: Date;
}
