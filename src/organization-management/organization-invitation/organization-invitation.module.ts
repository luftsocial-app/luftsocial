import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrganizationInvitationController } from './organization-invitation.controller';
import { OrganizationInvitationService } from './organization-invitation.service';

@Module({
  imports: [ConfigModule],
  controllers: [OrganizationInvitationController],
  providers: [OrganizationInvitationService],
  exports: [OrganizationInvitationService],
})
export class OrganizationInvitationModule {}
