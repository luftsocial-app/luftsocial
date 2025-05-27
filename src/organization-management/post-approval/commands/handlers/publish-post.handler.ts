import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PublishPostCommand } from '../publish-post.command';
import { TaskService } from '../../services/task.service';
import { UserPost, PostStatus } from '../../entities/post.entity';
import { PostPublishedEvent } from '../../events/post-published.event';
import { PublisherAdapterService } from '../../services/publisher-adapter.service';

@CommandHandler(PublishPostCommand)
export class PublishPostHandler implements ICommandHandler<PublishPostCommand> {
  private readonly logger = new Logger(PublishPostHandler.name);

  constructor(
    @InjectRepository(UserPost)
    private readonly postRepository: Repository<UserPost>,
    private readonly taskService: TaskService,
    private readonly publisherService: PublisherAdapterService,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: PublishPostCommand): Promise<UserPost> {
    const { postId, publishPostDto, userId, userRole, tenantId } = command;

    // Find post
    const post = await this.postRepository.findOne({
      where: { id: postId, tenantId },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    if (post.status !== PostStatus.APPROVED) {
      throw new BadRequestException(
        `Post must be approved before publishing, current status: ${post.status}`,
      );
    }

    // Check if user has permission to publish
    if (userRole !== 'manager') {
      throw new ForbiddenException('Only managers can publish posts');
    }

    // Check if scheduling for future publication
    if (
      publishPostDto.scheduledFor &&
      new Date(publishPostDto.scheduledFor) > new Date()
    ) {
      return this.schedulePost(post, publishPostDto.scheduledFor);
    }

    // Publish immediately
    return this.dataSource.transaction(async (entityManager) => {
      try {
        // Call the publishing service
        const publishResult = await this.publisherService.publishContent(
          userId,
          post.description,
          post.platforms.filter((p) =>
            publishPostDto.platforms.includes(p.platform),
          ),
          post.mediaItems || [],
        );

        if (!publishResult.success) {
          throw new Error(`Failed to publish post: ${publishResult.error}`);
        }

        // Update post status and publish ID
        post.status = PostStatus.PUBLISHED;
        post.publishId = publishResult.publishId;
        const publishedPost = await entityManager.save(UserPost, post);

        // Complete any publish tasks
        await this.taskService.completePublishTasks(
          postId,
          userId,
          entityManager,
        );

        // Publish event
        this.eventBus.publish(
          new PostPublishedEvent(
            publishedPost,
            userId,
            publishPostDto.platforms,
            publishResult.publishId,
          ),
        );

        return publishedPost;
      } catch (error) {
        this.logger.error(
          `Error publishing post ${postId}: ${error.message}`,
          error.stack,
        );
        throw error;
      }
    });
  }

  private async schedulePost(
    post: UserPost,
    scheduledDate: Date,
  ): Promise<UserPost> {
    post.status = PostStatus.SCHEDULED;
    post.scheduledFor = scheduledDate;

    return this.postRepository.save(post);
  }
}
