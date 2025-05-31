import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApprovalStep } from './approval-step.entity';

export enum ApprovalActionType {
  APPROVE = 'approve',
  REJECT = 'reject',
}

@Entity('approval_actions')
export class ApprovalAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ApprovalActionType,
  })
  action: ApprovalActionType;

  @Column({ nullable: true, type: 'text' })
  comment: string;

  @ManyToOne(() => ApprovalStep, (step) => step.actions)
  @JoinColumn({ name: 'approval_step_id' })
  approvalStep: ApprovalStep;

  @Column({ name: 'approval_step_id' })
  approvalStepId: string;

  @Column({ name: 'user_id', type: 'varchar' })
  userId: string; // Clerk user ID as string

  @CreateDateColumn()
  createdAt: Date;
}
