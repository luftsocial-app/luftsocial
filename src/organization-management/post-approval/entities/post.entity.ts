import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApprovalStep } from './approval-step.entity';
import { PlatformPostDto } from 'src/cross-platform/helpers/dtos/platform-post.dto';
import { Task } from './task.entity';

export enum PostStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  SCHEDULED = 'scheduled',
  PUBLISHED = 'published',
  REJECTED = 'rejected',
}

@Entity('user_posts')
export class UserPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column('jsonb', { nullable: true })
  mediaItems: string[];

  @Column({
    type: 'enum',
    enum: PostStatus,
    default: PostStatus.DRAFT,
  })
  status: PostStatus;

  @Column({ type: 'json', nullable: true })
  platforms: PlatformPostDto[];

  @OneToMany(() => Task, (task) => task.post)
  tasks: Task[];

  @Column({ nullable: true })
  scheduledFor: Date;

  @Column()
  authorId: string;

  @Column({ name: 'organization_id', type: 'varchar', length: 255 })
  organizationId: string;

  @Column()
  tenantId: string;

  @Column({ nullable: true })
  publishId: string;

  @OneToMany(() => ApprovalStep, (step) => step.post)
  approvalSteps: ApprovalStep[];

  @CreateDateColumn()
  submittedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
