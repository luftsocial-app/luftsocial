import { Controller, Get, Param } from '@nestjs/common';
import { PostsService } from './posts.service';
import { Roles } from '../../decorators/roles.decorator';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get(':postId')
  // @Roles('org:admin', 'org:editor') // Specify the roles required to access this route
  @Roles('org:member')
  // async findOne(@Param('id') id: string) {
  //   return this.postsService.findOne(id);
  // }
  async find(@Param('postId') postId: string) {
    console.log({ postId });
    return this.postsService.find();
  }
}
