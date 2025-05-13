import { PostStatus } from '../entities/post.entity';

export class GetorganizationPostsQuery {
  constructor(
    public readonly organizationId: string,
    public readonly tenantId: string,
    public readonly status?: PostStatus,
    public readonly page: number = 1,
    public readonly limit: number = 10,
  ) {}
}
