import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { PostResponseDto } from '../helper/dto/post-response.dto';
import { UserPost } from '../entities/post.entity';
import { GetPostDetailsQuery } from './get-post-details.query';

@QueryHandler(GetPostDetailsQuery)
export class GetPostDetailsHandler
  implements IQueryHandler<GetPostDetailsQuery>
{
  constructor(
    @InjectRepository(UserPost)
    private readonly postRepository: Repository<UserPost>,
  ) {}

  async execute(query: GetPostDetailsQuery): Promise<PostResponseDto> {
    const { postId, tenantId } = query;

    const post = await this.postRepository.findOne({
      where: { id: postId, tenantId },
      relations: ['approvalSteps', 'approvalSteps.actions'],
      order: {
        approvalSteps: {
          order: 'ASC',
          actions: {
            createdAt: 'DESC',
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    return new PostResponseDto(post);
  }
}
