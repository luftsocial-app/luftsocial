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

@Entity('instagram_media')
export class InstagramMedia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => InstagramAccount, (account) => account.media)
  account: InstagramAccount;

  @Column()
  mediaId: string;

  @Column()
  mediaType: string;

  @Column({ type: 'text', nullable: true })
  caption: string;

  @Column({ nullable: true })
  mediaUrl: string;

  @Column({ nullable: true })
  thumbnailUrl: string;

  @Column({ nullable: true })
  permalink: string;

  @Column({ type: 'timestamp' })
  postedAt: Date;

  @OneToMany(() => InstagramMetric, (metric) => metric.media)
  metrics: InstagramMetric[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
