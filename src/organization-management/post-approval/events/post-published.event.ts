import { UserPost } from '../entities/post.entity';

export class PostPublishedEvent {
  constructor(
    public readonly post: UserPost,
    public readonly userId: string,
    public readonly platforms: string[],
    public readonly publishId: string,
  ) {}
}
