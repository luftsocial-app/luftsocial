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

@Entity('facebook_posts')
export class FacebookPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FacebookPage, (page) => page.posts)
  page: FacebookPage;

  @Column()
  postId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ nullable: true })
  mediaType: string;

  @Column('simple-array', { nullable: true })
  mediaUrls: string[];

  @Column({ nullable: true })
  permalinkUrl: string;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ type: 'timestamp', nullable: true })
  scheduledTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;

  @OneToMany(() => FacebookPostMetric, (metric) => metric.post)
  metrics: FacebookPostMetric[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
