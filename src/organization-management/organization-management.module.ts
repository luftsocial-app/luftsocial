import { Module } from '@nestjs/common';
import { PostApprovalModule } from './post-approval/post-approval.module';

@Module({
  imports: [PostApprovalModule],
  providers: [],
  exports: [],
})
export class OrganizationManagementModule {}
