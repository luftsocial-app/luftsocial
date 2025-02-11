import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { TikTokAccount } from './tiktok-account.entity';

@Entity('tiktok_upload_sessions')
export class TikTokUploadSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TikTokAccount)
  account: TikTokAccount;

  @Column()
  uploadUrl: string;

  @Column('jsonb')
  uploadParams: any;

  @Column()
  status: 'PENDING' | 'COMPLETED' | 'FAILED';

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
