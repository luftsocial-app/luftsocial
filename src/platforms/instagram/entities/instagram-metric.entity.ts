import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { InstagramMedia } from './instagram-media.entity';

@Entity('instagram_metrics')
export class InstagramMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => InstagramMedia, (media) => media.metrics)
  media: InstagramMedia;

  @Column({ type: 'int', default: 0 })
  likesCount: number;

  @Column({ type: 'int', default: 0 })
  commentsCount: number;

  @Column({ type: 'int', default: 0 })
  savesCount: number;

  @Column({ type: 'int', default: 0 })
  reach: number;

  @Column({ type: 'int', default: 0 })
  impressions: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  engagementRate: number;

  @Column('jsonb', { nullable: true })
  audienceBreakdown: any;

  @Column('jsonb', { nullable: true })
  locationBreakdown: any;

  @Column({ type: 'timestamp' })
  collectedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @CreateDateColumn()
  updatedAt: Date;
}
