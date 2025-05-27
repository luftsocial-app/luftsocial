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
  BadRequestException,
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
import { Role, RoleGuard, Roles } from 'src/guards/role-guard';
import { AuthObject } from '@clerk/express';

@ApiTags('Organization Invitations')
@Controller('organizations/invitations')
@UseGuards(RoleGuard, OrganizationAccessGuard)
@UsePipes(new ValidationPipe({ transform: true }))
export class OrganizationInvitationController {
  constructor(
    private readonly organizationInvitationService: OrganizationInvitationService,
  ) {}

  @Post('/new-invitation')
  @ApiOperation({ summary: 'Create and send an organization invitation' })
  @ApiBody({ type: CreateInvitationDto })
  @ApiResponse({
    status: 201,
    description: 'The invitation has been successfully created and sent',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - User is not an admin' })
  @Roles(Role.Admin)
  async createInvitation(
    @Body() createInvitationDto: CreateInvitationDto,
    @CurrentUser() user: any,
  ): Promise<any> {
    return this.organizationInvitationService.createInvitation(
      user.orgId,
      createInvitationDto,
      user.userId,
    );
  }

  @Post(':invitationId/:organizationId/accept')
  @ApiOperation({ summary: 'Accept organization invitation' })
  @ApiParam({ name: 'organizationId', description: 'Organization ID' })
  @ApiParam({ name: 'invitationId', description: 'Invitation ID' })
  @ApiResponse({ status: 200, description: 'Invitation accepted successfully' })
  async acceptInvitation(
    @Param('organizationId') organizationId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthObject,
  ) {
    const userId = user?.userId;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    // First validate if user can accept the invitation
    const validation =
      await this.organizationInvitationService.validateInvitationAcceptance(
        organizationId,
        invitationId,
        userId,
      );

    if (!validation.canAccept) {
      throw new BadRequestException(validation.reason);
    }

    return this.organizationInvitationService.acceptInvitation(
      organizationId,
      invitationId,
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
  async listInvitations(@CurrentUser() user: any): Promise<any> {
    return this.organizationInvitationService.listInvitations(user.orgId);
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
