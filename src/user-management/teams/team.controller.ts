import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Put,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthObject } from '@clerk/express';
import { PinoLogger } from 'nestjs-pino';

@Controller('teams')
@UseGuards(ClerkAuthGuard)
export class TeamController {
  constructor(
    private readonly teamService: TeamService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(TeamController.name);
  }

  private getTenantId(authUser: AuthObject): string {
    const tenantId = authUser.claims?.org_id;
    if (!tenantId) {
      this.logger.error({ claims: authUser.claims }, 'Tenant ID (org_id) not found in user claims.');
      throw new ForbiddenException('Tenant ID not found in user claims. Cannot perform team operations.');
    }
    return tenantId;
  }

  private getUserId(authUser: AuthObject): string {
    const userId = authUser.claims?.sub;
    if (!userId) {
      this.logger.error({ claims: authUser.claims }, 'User ID (sub) not found in user claims.');
      throw new ForbiddenException('User ID not found in user claims.');
    }
    return userId;
  }

  @Post()
  async createTeam(@Body() createTeamDto: CreateTeamDto, @CurrentUser() authUser: AuthObject) {
    this.logger.info({ createTeamDto }, 'Received request to create team');
    const tenantId = this.getTenantId(authUser);
    const creatorId = this.getUserId(authUser);
    return this.teamService.createTeam(createTeamDto, tenantId, creatorId);
  }

  @Get()
  async getTeamsInTenant(@CurrentUser() authUser: AuthObject) {
    this.logger.info('Received request to get all teams in tenant');
    const tenantId = this.getTenantId(authUser);
    return this.teamService.getTeamsInTenant(tenantId);
  }

  @Get(':teamId')
  async getTeamById(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser() authUser: AuthObject,
  ) {
    this.logger.info({ teamId }, 'Received request to get team by ID');
    const tenantId = this.getTenantId(authUser);
    return this.teamService.getTeamById(teamId, tenantId);
  }

  @Put(':teamId')
  async updateTeam(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() updateTeamDto: UpdateTeamDto,
    @CurrentUser() authUser: AuthObject,
  ) {
    this.logger.info({ teamId, updateTeamDto }, 'Received request to update team');
    const tenantId = this.getTenantId(authUser);
    return this.teamService.updateTeam(teamId, updateTeamDto, tenantId);
  }

  @Delete(':teamId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTeam(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser() authUser: AuthObject,
  ) {
    this.logger.info({ teamId }, 'Received request to delete team');
    const tenantId = this.getTenantId(authUser);
    await this.teamService.deleteTeam(teamId, tenantId);
  }

  @Post(':teamId/members')
  async addMemberToTeam(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() addTeamMemberDto: AddTeamMemberDto,
    @CurrentUser() authUser: AuthObject,
  ) {
    this.logger.info({ teamId, addTeamMemberDto }, 'Received request to add member to team');
    const tenantId = this.getTenantId(authUser);
    return this.teamService.addMemberToTeam(teamId, addTeamMemberDto.userId, tenantId);
  }

  @Delete(':teamId/members/:userId')
  async removeMemberFromTeam(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId') userId: string, // Clerk user IDs are not necessarily UUIDs
    @CurrentUser() authUser: AuthObject,
  ) {
    this.logger.info({ teamId, userId }, 'Received request to remove member from team');
    const tenantId = this.getTenantId(authUser);
    return this.teamService.removeMemberFromTeam(teamId, userId, tenantId);
  }
}
