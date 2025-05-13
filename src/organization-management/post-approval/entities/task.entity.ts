import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../../user-management/entities/user.entity';
import { UserPost } from './post.entity';
import { ApprovalStep } from './approval-step.entity';

export enum TaskStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
}

export enum TaskType {
  REVIEW = 'review',
  PUBLISH = 'publish',
}

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: TaskType,
  })
  type: TaskType;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.PENDING,
  })
  status: TaskStatus;

  @ManyToOne(() => UserPost)
  @JoinColumn({ name: 'post_id' })
  post: UserPost;

  @Column({ name: 'post_id' })
  postId: string;

  @ManyToOne(() => ApprovalStep, { nullable: true })
  @JoinColumn({ name: 'approval_step_id' })
  approvalStep: ApprovalStep;

  @Column({ name: 'approval_step_id', nullable: true })
  approvalStepId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assignee_id' })
  assignee: User;

  @Column({ name: 'assignee_id' })
  assigneeId: string;

  @Column()
  organizationId: string;

  @Column()
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
