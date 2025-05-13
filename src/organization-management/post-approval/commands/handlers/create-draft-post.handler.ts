import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { CreateDraftPostCommand } from '../create-draft-post.command';
import { UserPost, PostStatus } from '../../entities/post.entity';

@CommandHandler(CreateDraftPostCommand)
export class CreateDraftPostHandler
  implements ICommandHandler<CreateDraftPostCommand>
{
  private readonly logger = new Logger(CreateDraftPostHandler.name);

  constructor(
    @InjectRepository(UserPost)
    private readonly postRepository: Repository<UserPost>,
  ) {}

  async execute(command: CreateDraftPostCommand): Promise<UserPost> {
    const { createDraftPostDto, userId, organizationId, tenantId } = command;

    try {
      // Create post with platform data
      const post = this.postRepository.create({
        title: createDraftPostDto.title,
        content: createDraftPostDto.content,
        platforms: createDraftPostDto.platforms,
        mediaItems: createDraftPostDto.mediaUrls || [],
        authorId: userId,
        organizationId,
        tenantId,
        status: PostStatus.DRAFT,
      });

      return this.postRepository.save(post);
    } catch (error) {
      this.logger.error(
        `Failed to create draft post: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
