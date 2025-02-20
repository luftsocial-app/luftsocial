import { Injectable, NotFoundException } from '@nestjs/common';
import { Post } from '../../entities/posts/post.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantService } from '../../database/tenant.service';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private readonly tenantService: TenantService,
  ) {}

  async findOne(id: string): Promise<Post> {
    const post = await this.postRepository.findOne({
      where: {
        id,
        tenantId: this.tenantService.getTenantId(),
      },
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async find(): Promise<Post[]> {
    return this.postRepository.find({
      where: { tenantId: this.tenantService.getTenantId() },
    });
  }

  async create(post: Partial<Post>): Promise<Post> {
    const newPost = this.postRepository.create({
      ...post,
      tenantId: this.tenantService.getTenantId(),
    });
    return this.postRepository.save(newPost);
  }

  async update(postId: string, post: Partial<Post>): Promise<Post> {
    await this.postRepository.update(
      {
        id: postId,
        tenantId: this.tenantService.getTenantId(),
      },
      post,
    );
    return this.findOne(postId);
  }

  async delete(postId: string): Promise<void> {
    const result = await this.postRepository.delete({
      id: postId,
      tenantId: this.tenantService.getTenantId(),
    });
    if (result.affected === 0) {
      throw new NotFoundException('Post not found');
    }
  }
}
