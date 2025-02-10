import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { Post } from './post.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsService } from './posts.service';
import { SeedService } from '../seed.service';
import { createRepositoryProvider } from '../database/repository.provider';

@Module({
  imports: [TypeOrmModule.forFeature([Post])],
  providers: [
    createRepositoryProvider(Post, 'POST'),
    PostsService,
    SeedService,
  ],
  controllers: [PostsController],
  exports: [PostsService],
})
export class PostsModule {}
