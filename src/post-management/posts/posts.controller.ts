import { Controller, Get, Param } from '@nestjs/common';
import { PostsService } from './posts.service';
import { Roles } from '../../decorators/roles.decorator';
import { PinoLogger } from 'nestjs-pino';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PostsController.name);
  }

  @Get(':postId')
  // @Roles('org:admin', 'org:editor') // Specify the roles required to access this route
  @Roles('org:member')
  // async findOne(@Param('id') id: string) {
  //   return this.postsService.findOne(id);
  // }
  async find(@Param('postId') postId: string) {
    this.logger.info({ postId });
    return this.postsService.find();
  }
}
