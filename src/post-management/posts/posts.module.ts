import { Module } from '@nestjs/common';
import { Post } from '../../entities/post.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [TypeOrmModule.forFeature([Post]), DatabaseModule],
  providers: [PostsService],
  controllers: [PostsController],
  exports: [PostsService],
})
export class PostsModule {}
