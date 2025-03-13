import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { TikTokAccount } from './tiktok-account.entity';
import { TenantEntity } from '../../../platforms/entity/tenant-entity';

@Entity('tiktok_upload_sessions')
export class TikTokUploadSession extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
