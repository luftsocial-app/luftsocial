import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { TikTokVideo } from './tiktok-video.entity';
import { TenantEntity } from 'src/platforms/entity/tenant-entity';

@Entity('tiktok_metrics')
export class TikTokMetric extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TikTokVideo, (video) => video.metrics)
  video: TikTokVideo;

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ type: 'int', default: 0 })
  likeCount: number;

  @Column({ type: 'int', default: 0 })
  commentCount: number;

  @Column({ type: 'int', default: 0 })
  shareCount: number;

  @Column({ type: 'int', default: 0 })
  playCount: number;

  @Column({ type: 'int', default: 0 })
  downloadCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  engagementRate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  averageWatchTime: number;

  @Column({ type: 'bigint', nullable: true })
  totalWatchTimeMillis: number;

  @Column('jsonb', { nullable: true })
  retentionRate: any;

  @Column('jsonb', { nullable: true })
  audienceTerritories: any;

  @Column({ type: 'timestamp' })
  collectedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
