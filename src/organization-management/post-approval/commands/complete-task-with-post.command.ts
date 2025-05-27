export class CompleteTaskWithPostCommand {
  constructor(
    public readonly taskId: string,
    public readonly postId: string,
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly completionNotes?: string,
  ) {}
}
