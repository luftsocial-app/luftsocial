import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Post } from '../../entities/posts/post.entity';
import { TenantAwareRepository } from '../../tenant-aware-repo/tenant-aware.repos';

@Injectable()
export class PostsService {
  constructor(
    @Inject(`TENANT_AWARE_REPOSITORY_${Post.name}`)
    private readonly postRepository: TenantAwareRepository<Post>,
  ) {}

  async findOneById(id: string): Promise<Post | null> {
    return this.postRepository.findById(id);
  }

  async findOne(id: string): Promise<Post> {
    const post = await this.postRepository.findOne({});
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async find(): Promise<Post[]> {
    return this.postRepository.find({});
  }

  async create(post: Partial<Post>): Promise<Post> {
    const newPost = this.postRepository.create({
      ...post,
    });
    return this.postRepository.save(newPost);
  }

  async update(postId: string, post: Partial<Post>): Promise<Post> {
    await this.postRepository.update(postId, post);
    return this.findOne(postId);
  }

  async delete(postId: string): Promise<void> {
    const result = await this.postRepository.delete(postId);
    if (result.affected === 0) {
      throw new NotFoundException('Post not found');
    }
  }
}
