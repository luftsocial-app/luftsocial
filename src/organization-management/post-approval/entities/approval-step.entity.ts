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
import { UserPost } from './post.entity';
import { ApprovalAction } from './approval-action.entity';

export enum ApprovalStepStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('approval_steps')
export class ApprovalStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  order: number;

  @Column()
  requiredRole: string;

  @Column({
    type: 'enum',
    enum: ApprovalStepStatus,
    default: ApprovalStepStatus.PENDING,
  })
  status: ApprovalStepStatus;

  @ManyToOne(() => UserPost, (post) => post.approvalSteps)
  @JoinColumn({ name: 'post_id' })
  post: UserPost;

  @Column({ name: 'post_id' })
  postId: string;

  @OneToMany(() => ApprovalAction, (action) => action.approvalStep)
  actions: ApprovalAction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
