import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { FacebookPage } from './facebook-page.entity';
import { FacebookPostMetric } from './facebook-post-metric.entity';
import { FacebookAccount } from './facebook-account.entity';
import { MediaStorageItem } from '../../../asset-management/media-storage/media-storage.dto';

@Entity('facebook_posts')
export class FacebookPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  tenantId: string;

  @ManyToOne(() => FacebookAccount)
  account: FacebookAccount;

  @ManyToOne(() => FacebookPage, (page) => page.posts)
  page: FacebookPage;

  @Column()
  postId: string;

  @Column({ type: 'text' })
  content: string;

  @Column('jsonb', { nullable: true })
  mediaItems: MediaStorageItem[];

  @Column({ nullable: true })
  permalinkUrl: string;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ type: 'timestamp', nullable: true })
  scheduledPublishTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;

  @OneToMany(() => FacebookPostMetric, (metric) => metric.post)
  metrics: FacebookPostMetric[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
