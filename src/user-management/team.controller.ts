import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ForbiddenException, // Added for better error handling
} from '@nestjs/common';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dtos/team/create-team.dto';
import { UpdateTeamDto } from './dtos/team/update-team.dto';
import { AddTeamMemberDto } from './dtos/team/add-team-member.dto';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard'; // Adjust path as needed
import { AuthenticatedRequest } from '../../common/interface/app.interface'; // Or wherever AuthenticatedRequest is defined

@Controller('teams')
@UseGuards(ClerkAuthGuard) // Protect all routes in this controller
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  async createTeam(@Body() createTeamDto: CreateTeamDto, @Request() req: AuthenticatedRequest) {
    const tenantId = req.auth?.orgId; 
    const createdByUserId = req.auth?.userId;
    if (!tenantId) {
      // Use NestJS built-in exception for consistency
      throw new ForbiddenException('Tenant ID not found in authenticated request.'); 
    }
    if (!createdByUserId) {
      throw new ForbiddenException('User ID not found in authenticated request.');
    }
    return this.teamService.createTeam(createTeamDto, tenantId, createdByUserId);
  }

  @Get()
  async findAllByTenant(@Request() req: AuthenticatedRequest) {
    const tenantId = req.auth?.orgId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID not found in authenticated request.');
    }
    return this.teamService.findAllByTenant(tenantId);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string, @Request() req: AuthenticatedRequest) {
    const tenantId = req.auth?.orgId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID not found in authenticated request.');
    }
    return this.teamService.findById(id, tenantId);
  }

  @Patch(':id')
  async updateTeam(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTeamDto: UpdateTeamDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const tenantId = req.auth?.orgId;
    const updatedByUserId = req.auth?.userId;
    if (!tenantId || !updatedByUserId) {
      throw new ForbiddenException('Tenant ID or User ID not found in authenticated request.');
    }
    return this.teamService.updateTeam(id, updateTeamDto, tenantId, updatedByUserId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTeam(@Param('id', ParseUUIDPipe) id: string, @Request() req: AuthenticatedRequest) {
    const tenantId = req.auth?.orgId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID not found in authenticated request.');
    }
    await this.teamService.deleteTeam(id, tenantId);
    // No explicit return needed due to @HttpCode(HttpStatus.NO_CONTENT)
  }

  @Post(':id/members')
  async addMember(
    @Param('id', ParseUUIDPipe) teamId: string,
    @Body() addTeamMemberDto: AddTeamMemberDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const tenantId = req.auth?.orgId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID not found in authenticated request.');
    }
    return this.teamService.addMember(teamId, addTeamMemberDto.userId, tenantId);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) memberUserId: string, 
    @Request() req: AuthenticatedRequest,
  ) {
    const tenantId = req.auth?.orgId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID not found in authenticated request.');
    }
    await this.teamService.removeMember(teamId, memberUserId, tenantId);
     // No explicit return needed
  }
}
