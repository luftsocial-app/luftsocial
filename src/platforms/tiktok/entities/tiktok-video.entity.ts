import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { TikTokAccount } from './tiktok-account.entity';
import { TikTokMetric } from './tiktok-metric.entity';
import { TikTokVideoPrivacyLevel } from '../helpers/tiktok.interfaces';
import { TenantEntity } from 'src/platforms/entity/tenant-entity';

@Entity('tiktok_videos')
export class TikTokVideo extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TikTokAccount)
  account: TikTokAccount;

  @Column()
  publishId: string;

  @Column({ nullable: true })
  uploadUrl: string;

  @Column()
  privacyLevel: TikTokVideoPrivacyLevel;

  @Column({ nullable: true })
  title: string;

  @Column({ default: false })
  disableDuet: boolean;

  @Column({ default: false })
  disableStitch: boolean;

  @Column({ default: false })
  disableComment: boolean;

  @Column({ nullable: true })
  videoCoverTimestampMs: number;

  @Column({ default: false })
  brandContentToggle: boolean;

  @Column({ default: false })
  brandOrganicToggle: boolean;

  @Column({ default: false })
  isAigc: boolean;

  @OneToMany(() => TikTokMetric, (metric) => metric.video)
  metrics: TikTokMetric[];

  @Column({
    type: 'enum',
    enum: ['PENDING', 'UPLOADED', 'PUBLISHED', 'FAILED'],
  })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
