export class SubmitPostForReviewCommand {
  constructor(
    public readonly postId: string,
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly completedTaskId?: string,
  ) {}
}
