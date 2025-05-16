import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';

import { OrganizationAccessGuard } from 'src/guards/organization-access.guard';
import { OrganizationInvitationService } from './organization-invitation.service';
import { CreateInvitationDto } from './helper/create-invitation.dto';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import {
  RequirePermissions,
  Role,
  RoleGuard,
  Roles,
} from 'src/guards/role-guard';

@ApiTags('Organization Invitations')
@Controller('organizations/:organizationId/invitations')
@UseGuards(RoleGuard, OrganizationAccessGuard)
@UsePipes(new ValidationPipe({ transform: true }))
export class OrganizationInvitationController {
  constructor(
    private readonly organizationInvitationService: OrganizationInvitationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create and send an organization invitation' })
  @ApiParam({
    name: 'organizationId',
    description: 'The ID of the organization',
  })
  @ApiBody({ type: CreateInvitationDto })
  @ApiResponse({
    status: 201,
    description: 'The invitation has been successfully created and sent',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - User is not an admin' })
  @Roles(Role.Admin)
  @RequirePermissions('member:invite')
  async createInvitation(
    @Param('organizationId') organizationId: string,
    @Body() createInvitationDto: CreateInvitationDto,
    @CurrentUser() user: any,
  ): Promise<any> {
    return this.organizationInvitationService.createInvitation(
      organizationId,
      createInvitationDto,
      user.userId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List all organization invitations' })
  @ApiParam({
    name: 'organizationId',
    description: 'The ID of the organization',
  })
  @ApiResponse({
    status: 200,
    description: 'List of invitations for the organization',
  })
  @Roles(Role.Admin)
  async listInvitations(
    @Param('organizationId') organizationId: string,
  ): Promise<any> {
    return this.organizationInvitationService.listInvitations(organizationId);
  }

  @Delete(':invitationId')
  @ApiOperation({ summary: 'Revoke an organization invitation' })
  @ApiParam({
    name: 'organizationId',
    description: 'The ID of the organization',
  })
  @ApiParam({ name: 'invitationId', description: 'The ID of the invitation' })
  @ApiResponse({
    status: 200,
    description: 'The invitation has been successfully revoked',
  })
  @Roles(Role.Admin)
  async revokeInvitation(
    @Param('organizationId') organizationId: string,
    @Param('invitationId') invitationId: string,
  ): Promise<any> {
    return this.organizationInvitationService.revokeInvitation(
      organizationId,
      invitationId,
    );
  }
}
