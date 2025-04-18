import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { LinkedInOrganization } from './linkedin-organization.entity';
import { MediaStorageItem } from '../../../asset-management/media-storage/media-storage.dto';

@Entity('linkedin_posts')
export class LinkedInPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  tenantId: string;

  @ManyToOne(() => LinkedInOrganization, (org) => org.posts)
  organization: LinkedInOrganization;

  @Column()
  postId: string;

  @Column('text')
  content: string;

  @Column({ nullable: true })
  shareUrl: string;

  @Column('jsonb', { nullable: true })
  mediaItems: MediaStorageItem[];

  @Column({ nullable: true })
  thumbnailUrl: string;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ type: 'timestamp', nullable: true })
  scheduledTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;

  @OneToMany(() => LinkedInMetric, (metric) => metric.post)
  metrics: LinkedInMetric[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('linkedin_metrics')
export class LinkedInMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LinkedInPost, (post) => post.metrics)
  post: LinkedInPost;

  @Column({ type: 'int', default: 0 })
  impressions: number;

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

  @Column({ type: 'timestamp' })
  collectedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
