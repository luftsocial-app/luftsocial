import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { ApprovalStep } from './entities/approval-step.entity';
import { ApprovalAction } from './entities/approval-action.entity';
import { Task } from './entities/task.entity';
import { PostService } from './services/post.service';
import { ApprovalService } from './services/approval.service';
import { TaskService } from './services/task.service';
import { PostController } from './controllers/post.controller';
import { ApprovalController } from './controllers/approval.controller';
import { TaskController } from './controllers/task.controller';
import { User } from 'src/user-management/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, ApprovalStep, ApprovalAction, Task, User]),
  ],
  controllers: [PostController, ApprovalController, TaskController],
  providers: [PostService, ApprovalService, TaskService],
  exports: [PostService, ApprovalService, TaskService],
})
export class PostApprovalModule {}
