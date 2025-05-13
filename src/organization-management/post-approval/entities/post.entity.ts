import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../../user-management/entities/user.entity';
import { ApprovalStep } from './approval-step.entity';
import { Organization } from 'src/user-management/entities/organization.entity';
import { SocialPlatform } from 'src/common/enums/social-platform.enum';

export class PlatformInterface {
  platform: SocialPlatform;

  platformAccountId?: string;
}
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
  content: string;

  @Column('jsonb', { nullable: true })
  mediaItems: string[];

  @Column({
    type: 'enum',
    enum: PostStatus,
    default: PostStatus.DRAFT,
  })
  status: PostStatus;

  @Column({ type: 'json', nullable: true })
  platforms: PlatformInterface[];

  @Column({ nullable: true })
  scheduledFor: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ name: 'author_id' })
  authorId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id' })
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
