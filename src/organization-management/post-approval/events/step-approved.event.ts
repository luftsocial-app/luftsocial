import { ApprovalStep } from '../entities/approval-step.entity';
import { UserPost } from '../entities/post.entity';

export class StepApprovedEvent {
  constructor(
    public readonly step: ApprovalStep,
    public readonly post: UserPost,
    public readonly userId: string,
    public readonly comment?: string,
  ) {}
}
