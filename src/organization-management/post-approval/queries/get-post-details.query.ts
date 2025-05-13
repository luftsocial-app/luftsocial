export class GetPostDetailsQuery {
  constructor(
    public readonly postId: string,
    public readonly tenantId: string,
  ) {}
}
