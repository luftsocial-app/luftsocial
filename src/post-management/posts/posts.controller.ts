import { Controller, Get, Param } from '@nestjs/common';
import { PostsService } from './posts.service';
import { Roles } from '../../decorators/roles.decorator';
import { Post } from '../../entities/posts/post.entity';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  // @Roles('org:admin', 'org:editor') // Specify the roles required to access this route
  @Roles('org:member')
  // async findOne(@Param('id') id: string) {
  //   return this.postsService.findOne(id);
  // }
  async find() {
    return this.postsService.find();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Post | null> {
    return this.postsService.findOneById(id);
  }
}
