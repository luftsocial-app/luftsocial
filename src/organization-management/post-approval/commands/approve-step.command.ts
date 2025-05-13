import { ApprovePostDto } from '../helper/dto/approve-post.dto';

export class ApproveStepCommand {
  constructor(
    public readonly postId: string,
    public readonly stepId: string,
    public readonly approvePostDto: ApprovePostDto,
    public readonly userId: string,
    public readonly userRole: string,
    public readonly tenantId: string,
  ) {}
}
