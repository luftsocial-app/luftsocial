import { UserPost } from '../entities/post.entity';
import { ApprovalStep } from '../entities/approval-step.entity';

export class PostSubmittedEvent {
  constructor(
    public readonly post: UserPost,
    public readonly userId: string,
    public readonly approvalSteps: ApprovalStep[],
    public readonly completedTaskId?: string,
    public readonly associatedTasks?: string[],
  ) {}
}
