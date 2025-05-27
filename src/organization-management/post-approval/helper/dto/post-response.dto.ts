import { ApiProperty } from '@nestjs/swagger';
import { UserPost, PostStatus } from '../../entities/post.entity';

export class PostResponseDto {
  id: string;
  title: string;
  description: string;
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

  @ApiProperty({ description: 'Associated tasks information' })
  tasks?: {
    id: string;
    title: string;
    type: string;
    status: string;
    assignees?: Array<{
      id: string;
      name?: string;
      email?: string;
    }>;
  }[];

  constructor(post: UserPost) {
    this.id = post.id;
    this.title = post.title;
    this.description = post.description;
    this.status = post.status;
    this.authorId = post.authorId;
    this.organizationId = post.organizationId;
    this.createdAt = post.createdAt;
    this.updatedAt = post.updatedAt;
    this.platforms = post.platforms || [];
    this.mediaItems = post.mediaItems || [];

    if (post.tasks) {
      this.tasks = post.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        type: task.type,
        status: task.status,
        assignees: task.assigneeIds
          ? task.assigneeIds.map((id) => ({ id }))
          : [],
      }));

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
}
