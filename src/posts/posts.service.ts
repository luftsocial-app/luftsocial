import { Injectable, Inject } from '@nestjs/common';
import { Post } from './post.entity';
import { TenantAwareRepository } from '../database/tenant-aware.repository';

@Injectable()
export class PostsService {
  constructor(
    @Inject('TenantAwarePostRepository')
    private readonly postRepository: TenantAwareRepository<Post>,
  ) {}

  async findOne(id: string): Promise<Post> {
    return this.postRepository.findOne({
      where: { id },
    });
  }

  async find(): Promise<Post[]> {
    return this.postRepository.find();
  }

  async create(post: Partial<Post>): Promise<Post> {
    const newPost = this.postRepository.create(post);
    return this.postRepository.save(newPost);
  }

  async update(postId: string, post: Partial<Post>): Promise<Post> {
    await this.postRepository.update({ id: postId }, post);
    return this.postRepository.findOne({ where: { id: postId } });
  }

  async delete(postId: string): Promise<void> {
    await this.postRepository.delete({ id: postId });
  }
}
