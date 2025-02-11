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

@Entity('tiktok_videos')
export class TikTokVideo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TikTokAccount, (account) => account.videos)
  account: TikTokAccount;

  @Column()
  platformVideoId: string;

  @Column()
  videoId: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  shareUrl: string;

  @Column({ nullable: true })
  embedUrl: string;

  @Column({ nullable: true })
  thumbnailUrl: string;

  @Column({ type: 'int', nullable: true })
  duration: number;

  @Column({ type: 'int', nullable: true })
  width: number;

  @Column({ type: 'int', nullable: true })
  height: number;

  @Column('jsonb', { nullable: true })
  musicInfo: any;

  @Column()
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  scheduledTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  postedAt: Date;

  @OneToMany(() => TikTokMetric, (metric) => metric.video)
  metrics: TikTokMetric[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
