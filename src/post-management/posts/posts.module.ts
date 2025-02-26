import { Module } from '@nestjs/common';
import { Post } from '../../entities/posts/post.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { TenantAwareRepoModule } from '../../tenant-aware-repo/tenant-aware-repo.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post]),
    TenantAwareRepoModule.forFeature([Post]),
  ],
  providers: [PostsService],
  controllers: [PostsController],
  exports: [PostsService],
})
export class PostsModule {}
