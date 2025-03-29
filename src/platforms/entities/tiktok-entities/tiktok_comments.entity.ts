import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { TikTokVideo } from './tiktok-video.entity';

@Entity('tiktok_comments')
export class TikTokComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  tenantId: string;

  @ManyToOne(() => TikTokVideo)
  video: TikTokVideo;

  @Column()
  platformCommentId: string;

  @Column()
  content: string;

  @Column()
  authorId: string;

  @Column()
  authorUsername: string;

  @Column({ type: 'int', default: 0 })
  likeCount: number;

  @Column({ type: 'int', default: 0 })
  replyCount: number;

  @Column({ type: 'timestamp' })
  commentedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
