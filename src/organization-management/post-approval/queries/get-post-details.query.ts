export class GetPostDetailsQuery {
  constructor(
    public readonly postId: string,
    public readonly tenantId: string,
  ) {}
}

export class GetPostsByTaskQuery {
  constructor(
    public readonly taskId: string,
    public readonly organizationId: string,
    public readonly tenantId: string,
  ) {}
}

export class GetUserAssignedPostsQuery {
  constructor(
    public readonly userId: string,
    public readonly organizationId: string,
    public readonly tenantId: string,
    public readonly taskStatus?: string,
    public readonly postStatus?: string,
  ) {}
}
