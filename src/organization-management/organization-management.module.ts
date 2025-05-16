import { Module } from '@nestjs/common';
import { PostApprovalModule } from './post-approval/post-approval.module';
import { OrganizationInvitationModule } from './organization-invitation/organization-invitation.module';

@Module({
  imports: [PostApprovalModule, OrganizationInvitationModule],
  providers: [],
  exports: [],
})
export class OrganizationManagementModule {}
