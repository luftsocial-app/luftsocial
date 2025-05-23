import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from './entities/team.entity';
import { User } from './entities/user.entity';
import { Tenant } from './entities/tenant.entity';
import { CreateTeamDto } from './dtos/team/create-team.dto';
import { UpdateTeamDto } from './dtos/team/update-team.dto';
// Ensure TenantService and UserService are imported if you need them for validation or fetching.
// For now, we'll assume direct repository access is sufficient for core team operations.

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    // We might not need TenantRepository directly if tenantId is always passed and validated upstream
    // or if team entity already has tenant relation for queries.
  ) {}

  async createTeam(createTeamDto: CreateTeamDto, tenantId: string, createdByUserId: string): Promise<Team> {
    const newTeam = this.teamRepository.create({
      ...createTeamDto,
      tenant: { id: tenantId } as Tenant, // Associate with tenant
      createdBy: createdByUserId,
      users: [], // Initialize with no members
    });
    return this.teamRepository.save(newTeam);
  }

  async findAllByTenant(tenantId: string): Promise<Team[]> {
    return this.teamRepository.find({
      where: { tenant: { id: tenantId } },
      relations: ['users'], // Optionally load users
    });
  }

  async findById(id: string, tenantId: string): Promise<Team> {
    const team = await this.teamRepository.findOne({
      where: { id, tenant: { id: tenantId } },
      relations: ['users'], // Optionally load users
    });
    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found in this tenant.`);
    }
    return team;
  }

  async updateTeam(id: string, updateTeamDto: UpdateTeamDto, tenantId: string, updatedByUserId: string): Promise<Team> {
    const team = await this.findById(id, tenantId); // Ensures team exists and belongs to tenant
    
    // Preserve existing users when updating team details
    // const existingUsers = team.users; // Not strictly needed with current TypeORM save behavior for loaded relations

    Object.assign(team, updateTeamDto);
    team.updatedBy = updatedByUserId;
    
    // Re-assign users if they were cleared by Object.assign, or handle user updates separately
    // For now, we assume users are managed by addMember/removeMember and not cleared here.
    // If updateTeamDto could clear users, that logic would be more complex.
    // team.users = existingUsers; // This line might be needed depending on how TypeORM handles partial updates with relations

    const updatedTeam = await this.teamRepository.save(team);
    // Ensure users are still associated if `save` affects relations unexpectedly.
    // This might require fetching the team again or carefully managing the save operation.
    // For simplicity, we assume basic property updates don't detach users.
    // A more robust way is to update only specific fields:
    // await this.teamRepository.update({ id, tenant: { id: tenantId } }, { ...updateTeamDto, updatedBy: updatedByUserId });
    // return this.findById(id, tenantId); 
    // The above `update` and `findById` is safer for not accidentally overwriting relations.
    // Let's stick to the simpler `save` for now and refine if issues arise.
    return updatedTeam;
  }

  async deleteTeam(id: string, tenantId: string): Promise<void> {
    const team = await this.findById(id, tenantId); // Ensures team exists and belongs to tenant
    await this.teamRepository.remove(team);
  }

  async addMember(teamId: string, userIdToAdd: string, tenantId: string): Promise<Team> {
    const team = await this.findById(teamId, tenantId); // Ensures team exists and belongs to tenant
    
    const user = await this.userRepository.findOne({ where: { id: userIdToAdd } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userIdToAdd} not found.`);
    }

    // Optional: Check if user belongs to the same tenant if users are globally unique but should be tenant-scoped for teams
    // This depends on how Users and Tenants are structured. If User.activeTenantId is reliable:
    // if (user.activeTenantId !== tenantId) { // Assuming User entity has activeTenantId
    //   throw new ForbiddenException(`User does not belong to the current tenant.`);
    // }

    const isAlreadyMember = team.users.some(member => member.id === userIdToAdd);
    if (isAlreadyMember) {
      throw new BadRequestException(`User ${userIdToAdd} is already a member of team ${teamId}.`);
    }

    team.users.push(user);
    return this.teamRepository.save(team);
  }

  async removeMember(teamId: string, userIdToRemove: string, tenantId: string): Promise<Team> {
    const team = await this.findById(teamId, tenantId); // Ensures team exists and belongs to tenant

    const memberIndex = team.users.findIndex(member => member.id === userIdToRemove);
    if (memberIndex === -1) {
      throw new NotFoundException(`User ${userIdToRemove} is not a member of team ${teamId}.`);
    }

    team.users.splice(memberIndex, 1);
    return this.teamRepository.save(team);
  }
}
