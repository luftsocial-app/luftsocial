import { Module } from '@nestjs/common';
import { Post } from '../../entities/posts/post.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { TenantModule } from 'src/user-management/tenant/tenant.module';

@Module({
  imports: [TypeOrmModule.forFeature([Post]), TenantModule],
  providers: [PostsService],
  controllers: [PostsController],
  exports: [PostsService],
})
export class PostsModule {}
