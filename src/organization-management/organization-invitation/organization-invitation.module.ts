import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrganizationInvitationController } from './organization-invitation.controller';
import { OrganizationInvitationService } from './organization-invitation.service';
import { RoleGuard } from 'src/guards/role-guard';
import { OrganizationAccessGuard } from 'src/guards/organization-access.guard';

@Module({
  imports: [ConfigModule],
  controllers: [OrganizationInvitationController],
  providers: [
    OrganizationInvitationService,
    RoleGuard,
    OrganizationAccessGuard,
  ],
  exports: [OrganizationInvitationService],
})
export class OrganizationInvitationModule {}
