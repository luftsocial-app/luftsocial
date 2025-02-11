import { Injectable, OnModuleInit } from '@nestjs/common';
import { PostsService } from './posts/posts.service';
import { Post } from './entities/post.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(private readonly postsService: PostsService) { }

  async onModuleInit() {
    const posts: Partial<Post>[] = [
      {
        title: 'Post 1',
        content: 'Content for post 1',
        organizationId: 'org_2se12SO189SxUvkqgTFI1uU7vqb',
      },
      {
        title: 'Post 2',
        content: 'Content for post 2',
        organizationId: 'org_false1',
      },
      {
        title: 'Post 3',
        content: 'Content for post 3',
        organizationId: 'org_false2',
      },
      {
        title: 'Post 4',
        content: 'Content for post 4',
        organizationId: 'org_false3',
      },
      // Add more posts with false organization IDs as needed
    ];

    for (const post of posts) {
      await this.postsService.create(post);
    }
  }
}
