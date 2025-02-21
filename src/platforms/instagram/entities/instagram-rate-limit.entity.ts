import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InstagramAccount } from './instagram-account.entity';

@Entity('instagram_rate_limits')
export class InstagramRateLimit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => InstagramAccount)
  @JoinColumn({ name: 'account_id' })
  account: InstagramAccount;

  @Column()
  action: string;

  @CreateDateColumn()
  createdAt: Date;
}
