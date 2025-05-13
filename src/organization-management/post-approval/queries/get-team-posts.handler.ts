import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GetorganizationPostsQuery } from './get-team-posts.query';
import { UserPost } from '../entities/post.entity';
import { PostResponseDto } from '../helper/dto/post-response.dto';

@QueryHandler(GetorganizationPostsQuery)
export class GetorganizationPostsHandler
  implements IQueryHandler<GetorganizationPostsQuery>
{
  constructor(
    @InjectRepository(UserPost)
    private readonly postRepository: Repository<UserPost>,
  ) {}

  async execute(
    query: GetorganizationPostsQuery,
  ): Promise<{ posts: PostResponseDto[]; total: number }> {
    const { organizationId, tenantId, status, page, limit } = query;

    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .where('post.organizationId = :organizationId', { organizationId })
      .andWhere('post.tenantId = :tenantId', { tenantId });

    if (status) {
      queryBuilder.andWhere('post.status = :status', { status });
    }

    // Add relations
    queryBuilder
      .leftJoinAndSelect('post.approvalSteps', 'approvalStep')
      .leftJoinAndSelect('post.categories', 'category')
      .leftJoinAndSelect('post.author', 'author')
      .orderBy('post.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [posts, total] = await queryBuilder.getManyAndCount();

    return {
      posts: posts.map((post) => new PostResponseDto(post)),
      total,
    };
  }
}
