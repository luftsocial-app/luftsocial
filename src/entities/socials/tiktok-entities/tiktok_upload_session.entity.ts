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
export class TikTokUploadSession  {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  tenantId: string;

  @ManyToOne(() => TikTokAccount)
  account: TikTokAccount;

  @Column()
  publishId: string;

  @Column()
  uploadUrl: string;

  @Column('jsonb')
  uploadParams: any;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
  })
  status: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
