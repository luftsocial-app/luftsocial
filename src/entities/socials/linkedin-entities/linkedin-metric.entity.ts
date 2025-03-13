import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { LinkedInPost } from './linkedin-post.entity';
import { TenantEntity } from '../../notifications/entity/tenant-entity';


@Entity('linkedin_metrics')
export class LinkedInMetric extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LinkedInPost, (post) => post.metrics)
  post: LinkedInPost;

  @Column({ type: 'int', default: 0 })
  impressions: number;

  @Column({ type: 'int', default: 0 })
  uniqueImpressions: number;

  @Column({ type: 'int', default: 0 })
  clicks: number;

  @Column({ type: 'int', default: 0 })
  likes: number;

  @Column({ type: 'int', default: 0 })
  comments: number;

  @Column({ type: 'int', default: 0 })
  shares: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  engagementRate: number;

  @Column('jsonb', { nullable: true })
  demographicData: any;

  @Column('jsonb', { nullable: true })
  industryData: any;

  @Column({ type: 'timestamp' })
  collectedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @CreateDateColumn()
  updatedAt: Date;
}
