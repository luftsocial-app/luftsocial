import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserPost } from './entities/post.entity';
import { ApprovalStep } from './entities/approval-step.entity';
import { ApprovalAction } from './entities/approval-action.entity';
import { Task } from './entities/task.entity';
import { ApprovalService } from './services/approval.service';
import { TaskService } from './services/task.service';
import { ApprovalController } from './controllers/approval.controller';
import { TaskController } from './controllers/task.controller';
import { User } from 'src/user-management/entities/user.entity';
import { CqrsModule } from '@nestjs/cqrs';
import { WorkflowTemplate } from './entities/workflow-template.entity';
import { WorkflowStep } from './entities/workflow-step.entity';
import { ApproveStepHandler } from './commands/handlers/approve-step.handler';
import { CreateDraftPostHandler } from './commands/handlers/create-draft-post.handler';
import { PublishPostHandler } from './commands/handlers/publish-post.handler';
import { SubmitPostForReviewHandler } from './commands/handlers/submit-post-handler';
import { GetPostDetailsHandler } from './queries/get-post-details.handler';
import { GetorganizationPostsHandler } from './queries/get-team-posts.handler';
import { PublisherAdapterService } from './services/publisher-adapter.service';
import { PostPublishedHandler } from './services/event-handlers/post-published.handler';
import { PostSubmittedHandler } from './services/event-handlers/post-submitted.handler';
import { StepApprovedHandler } from './services/event-handlers/step-approved.handler';
import { StepRejectedHandler } from './services/event-handlers/step-rejected.handler';
import { CrossPlatformModule } from 'src/cross-platform/cross-platform.module';
import { AuditModule } from 'src/audit/audit.module';
import { OrganizationAccessGuard } from 'src/guards/organization-access.guard';
import { RoleGuard } from 'src/guards/role-guard';

@Module({
  imports: [
    CqrsModule,
    CrossPlatformModule,
    AuditModule,
    TypeOrmModule.forFeature([
      UserPost,
      ApprovalStep,
      ApprovalAction,
      Task,
      User,
      WorkflowTemplate,
      WorkflowStep,
    ]),
  ],
  controllers: [ApprovalController, TaskController],
  providers: [
    RoleGuard,
    OrganizationAccessGuard,
    PublisherAdapterService,
    ApprovalService,
    TaskService,
    ApproveStepHandler,
    CreateDraftPostHandler,
    PublishPostHandler,
    PublishPostHandler,
    SubmitPostForReviewHandler,
    GetPostDetailsHandler,
    GetorganizationPostsHandler,
    PostPublishedHandler,
    PostSubmittedHandler,
    StepApprovedHandler,
    StepRejectedHandler,
  ],
  exports: [ApprovalService, TaskService],
})
export class PostApprovalModule {}
