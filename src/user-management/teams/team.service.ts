import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '../entities/team.entity';
import { User } from '../entities/user.entity';
import { Tenant } from '../entities/tenant.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(TeamService.name);
  }

  async createTeam(
    createTeamDto: CreateTeamDto,
    tenantId: string,
    creatorId: string,
  ): Promise<Team> {
    this.logger.info(
      { tenantId, creatorId, createTeamDto },
      'Attempting to create a new team',
    );

    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) {
      this.logger.warn({ tenantId }, 'Tenant not found');
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    const creator = await this.userRepository.findOne({
      where: { id: creatorId, activeTenantId: tenantId },
    });
    if (!creator) {
      this.logger.warn(
        { creatorId, tenantId },
        'Creator not found or not active in the specified tenant',
      );
      throw new NotFoundException(
        `Creator with ID ${creatorId} not found in tenant ${tenantId}`,
      );
    }

    const team = this.teamRepository.create({
      ...createTeamDto,
      tenant,
      users: [creator], // Add creator to the team
      createdBy: creator, // Set the creator of the team
    });

    try {
      const savedTeam = await this.teamRepository.save(team);
      this.logger.info(
        { teamId: savedTeam.id, tenantId },
        'Team created successfully',
      );
      return savedTeam;
    } catch (error) {
      this.logger.error(
        { error, createTeamDto, tenantId },
        'Error creating team',
      );
      throw new BadRequestException('Could not create team.');
    }
  }

  async getTeamById(teamId: string, tenantId: string): Promise<Team> {
    this.logger.info({ teamId, tenantId }, 'Attempting to retrieve team by ID');
    const team = await this.teamRepository.findOne({
      where: { id: teamId, tenant: { id: tenantId } },
      relations: ['users', 'tenant', 'createdBy'],
    });

    if (!team) {
      this.logger.warn(
        { teamId, tenantId },
        'Team not found in the specified tenant',
      );
      throw new NotFoundException(
        `Team with ID ${teamId} not found in tenant ${tenantId}`,
      );
    }
    return team;
  }

  async getTeamsInTenant(tenantId: string): Promise<Team[]> {
    this.logger.info(
      { tenantId },
      'Attempting to retrieve all teams in tenant',
    );
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) {
      this.logger.warn({ tenantId }, 'Tenant not found');
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }
    return this.teamRepository.find({
      where: { tenant: { id: tenantId } },
      relations: ['users', 'createdBy'], // Include users and creator if needed in the list view
    });
  }

  async updateTeam(
    teamId: string,
    updateTeamDto: UpdateTeamDto,
    tenantId: string,
  ): Promise<Team> {
    this.logger.info(
      { teamId, tenantId, updateTeamDto },
      'Attempting to update team',
    );
    const team = await this.getTeamById(teamId, tenantId); // Leverages existing check

    // Merge the new data
    Object.assign(team, updateTeamDto);

    try {
      const updatedTeam = await this.teamRepository.save(team);
      this.logger.info(
        { teamId: updatedTeam.id, tenantId },
        'Team updated successfully',
      );
      return updatedTeam;
    } catch (error) {
      this.logger.error(
        { error, teamId, updateTeamDto, tenantId },
        'Error updating team',
      );
      throw new BadRequestException('Could not update team.');
    }
  }

  async deleteTeam(teamId: string, tenantId: string): Promise<void> {
    this.logger.info({ teamId, tenantId }, 'Attempting to delete team');
    const team = await this.getTeamById(teamId, tenantId); // Ensures team exists and belongs to tenant

    try {
      await this.teamRepository.remove(team);
      this.logger.info({ teamId, tenantId }, 'Team deleted successfully');
    } catch (error) {
      this.logger.error({ error, teamId, tenantId }, 'Error deleting team');
      throw new BadRequestException('Could not delete team.');
    }
  }

  async addMemberToTeam(
    teamId: string,
    userId: string,
    tenantId: string,
  ): Promise<Team> {
    this.logger.info(
      { teamId, userId, tenantId },
      'Attempting to add member to team',
    );
    const team = await this.getTeamById(teamId, tenantId); // Ensures team exists and belongs to tenant

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn({ userId }, 'User to be added not found');
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check if the user belongs to the same tenant as the team
    // This check depends on how you associate users with tenants.
    // If User entity has a direct tenantId or a relation to Tenant:
    if (user.activeTenantId !== tenantId) {
      this.logger.warn(
        { userId, userTenantId: user.activeTenantId, teamTenantId: tenantId },
        "User does not belong to the team's tenant",
      );
      throw new ForbiddenException(
        `User with ID ${userId} does not belong to tenant ${tenantId}`,
      );
    }

    // Check if user is already in the team
    const isAlreadyMember = team.users.some((member) => member.id === userId);
    if (isAlreadyMember) {
      this.logger.info(
        { userId, teamId },
        'User is already a member of the team',
      );
      return team; // Or throw BadRequestException if preferred
    }

    team.users.push(user);

    try {
      const updatedTeam = await this.teamRepository.save(team);
      this.logger.info(
        { teamId, userId, tenantId },
        'Member added to team successfully',
      );
      return updatedTeam;
    } catch (error) {
      this.logger.error(
        { error, teamId, userId, tenantId },
        'Error adding member to team',
      );
      throw new BadRequestException('Could not add member to team.');
    }
  }

  async removeMemberFromTeam(
    teamId: string,
    userId: string,
    tenantId: string,
  ): Promise<Team> {
    this.logger.info(
      { teamId, userId, tenantId },
      'Attempting to remove member from team',
    );
    const team = await this.getTeamById(teamId, tenantId); // Ensures team exists and belongs to tenant

    const userIndex = team.users.findIndex((member) => member.id === userId);
    if (userIndex === -1) {
      this.logger.warn({ userId, teamId }, 'User not found in team');
      throw new NotFoundException(
        `User with ID ${userId} not found in team ${teamId}`,
      );
    }

    team.users.splice(userIndex, 1);

    try {
      const updatedTeam = await this.teamRepository.save(team);
      this.logger.info(
        { teamId, userId, tenantId },
        'Member removed from team successfully',
      );
      return updatedTeam;
    } catch (error) {
      this.logger.error(
        { error, teamId, userId, tenantId },
        'Error removing member from team',
      );
      throw new BadRequestException('Could not remove member from team.');
    }
  }
}
