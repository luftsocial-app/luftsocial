import { RejectPostDto } from '../helper/dto/reject-post.dto';

export class RejectStepCommand {
  constructor(
    public readonly postId: string,
    public readonly stepId: string,
    public readonly rejectPostDto: RejectPostDto,
    public readonly userId: string,
    public readonly userRole: string,
    public readonly tenantId: string,
  ) {}
}
