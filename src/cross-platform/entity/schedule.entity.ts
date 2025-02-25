import { SocialPlatform } from 'src/enum/social-platform.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  PublishPlatformResult,
  ScheduleStatus,
} from '../helpers/cross-platform.interface';
import { MediaStorageItem } from 'src/media-storage/media-storage.dto';

@Entity('scheduled_posts')
export class ScheduledPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column('text')
  content: string;

  @Column('simple-array', { nullable: true })
  mediaUrls: string[];

  @Column('jsonb', { nullable: true })
  mediaItems: MediaStorageItem[];

  @Column('jsonb')
  platforms: {
    platform: SocialPlatform;
    accountId: string;
    platformSpecificParams?: any;
  }[];

  @Column({ type: 'timestamp' })
  scheduledTime: Date;

  @Column({
    type: 'enum',
    enum: ScheduleStatus,
    default: ScheduleStatus.PENDING,
  })
  status: ScheduleStatus;

  @Column('jsonb', { nullable: true })
  results: PublishPlatformResult[];

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;

  @Column({ nullable: true })
  error?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
