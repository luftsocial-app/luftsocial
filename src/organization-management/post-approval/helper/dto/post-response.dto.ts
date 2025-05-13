import { UserPost, PostStatus } from '../../entities/post.entity';

export class PostResponseDto {
  id: string;
  title: string;
  content: string;
  status: PostStatus;
  authorId: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  platforms: any[];
  mediaItems: string[];
  approvalSteps?: {
    id: string;
    name: string;
    order: number;
    status: string;
    requiredRole: string;
  }[];

  constructor(post: UserPost) {
    this.id = post.id;
    this.title = post.title;
    this.content = post.content;
    this.status = post.status;
    this.authorId = post.authorId;
    this.organizationId = post.organizationId;
    this.createdAt = post.createdAt;
    this.updatedAt = post.updatedAt;
    this.platforms = post.platforms || [];
    this.mediaItems = post.mediaItems || [];

    if (post.approvalSteps) {
      this.approvalSteps = post.approvalSteps
        .sort((a, b) => a.order - b.order)
        .map((step) => ({
          id: step.id,
          name: step.name,
          order: step.order,
          status: step.status,
          requiredRole: step.requiredRole,
        }));
    }
  }
}
