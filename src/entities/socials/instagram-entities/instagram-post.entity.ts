import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { InstagramAccount } from './instagram-account.entity';
import { InstagramMetric } from './instagram-metric.entity';
import { TenantEntity } from '../../notifications/entity/tenant-entity';
import { MediaStorageItem } from '../../../asset-management/media-storage/media-storage.dto';

@Entity('instagram_post')
export class InstagramPost extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => InstagramAccount, (account) => account.media)
  account: InstagramAccount;

  @Column()
  postId: string;

  @Column({ type: 'text', nullable: true })
  caption: string;

  @Column('jsonb')
  hashtags: string[];

  @Column('jsonb')
  mentions: string[];

  @Column({ nullable: true })
  thumbnailUrl: string;

  @Column('jsonb', { nullable: true })
  mediaItems: MediaStorageItem[];

  @Column({ nullable: true })
  permalink: string;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ type: 'timestamp', nullable: true })
  scheduledTime: Date;

  @Column({ type: 'timestamp' })
  postedAt: Date;

  @OneToMany(() => InstagramMetric, (metric) => metric.media)
  metrics: InstagramMetric[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
