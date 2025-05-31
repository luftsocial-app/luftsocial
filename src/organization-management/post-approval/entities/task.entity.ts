import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
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

  @Column({ name: 'post_id', nullable: true })
  postId: string;

  @ManyToOne(() => ApprovalStep, { nullable: true })
  @JoinColumn({ name: 'approval_step_id' })
  approvalStep: ApprovalStep;

  @Column({ name: 'approval_step_id', nullable: true })
  approvalStepId: string;

  // Array of assignee IDs for multiple assignees
  @Column('jsonb')
  assigneeIds: string[];

  @Column()
  organizationId: string;

  @Column()
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods for managing multiple assignees

  /**
   * Check if a user is assigned to this task
   */
  isAssignedTo(userId: string): boolean {
    return this.assigneeIds ? this.assigneeIds.includes(userId) : false;
  }

  /**
   * Get the count of assignees
   */
  get assigneeCount(): number {
    return this.assigneeIds ? this.assigneeIds.length : 0;
  }

  /**
   * Add an assignee to the task
   */
  addAssignee(userId: string): void {
    if (!this.assigneeIds) {
      this.assigneeIds = [];
    }

    if (!this.assigneeIds.includes(userId)) {
      this.assigneeIds.push(userId);
    }
  }

  /**
   * Remove an assignee from the task
   */
  removeAssignee(userId: string): void {
    if (this.assigneeIds) {
      this.assigneeIds = this.assigneeIds.filter((id) => id !== userId);
    }
  }

  /**
   * Set multiple assignees (replaces all current assignees)
   */
  setAssignees(userIds: string[]): void {
    this.assigneeIds =
      userIds && userIds.length > 0 ? [...new Set(userIds)] : [];
  }

  /**
   * Check if task has any assignees
   */
  get hasAssignees(): boolean {
    return this.assigneeCount > 0;
  }

  /**
   * Get primary assignee (first assignee in the list)
   */
  get primaryAssigneeId(): string | null {
    return this.assigneeIds && this.assigneeIds.length > 0
      ? this.assigneeIds[0]
      : null;
  }

  /**
   * Clear all assignees
   */
  clearAssignees(): void {
    this.assigneeIds = [];
  }

  /**
   * Validation helper: Ensures data consistency
   */
  validateAssigneeData(): void {
    if (this.assigneeIds) {
      // Remove duplicates
      this.assigneeIds = [...new Set(this.assigneeIds)];
    } else {
      // Ensure array is initialized
      this.assigneeIds = [];
    }
  }
}
