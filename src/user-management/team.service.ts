import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CLERK_CLIENT } from '../clerk/clerk.provider'; // Adjusted path
import { ClerkClient } from '@clerk/backend';
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
    @Inject(CLERK_CLIENT) private readonly clerkClient: ClerkClient,
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
    
    let clerkUser;
    try {
      clerkUser = await this.clerkClient.users.getUser(userIdToAdd);
    } catch (error) {
      // Clerk client throws an error if user not found, which is sufficient
      // Log the error for debugging if necessary
      // console.error("Clerk API error fetching user:", error);
      throw new NotFoundException(`User with ID ${userIdToAdd} not found via Clerk.`);
    }

    // Check if the Clerk user is part of the tenant associated with the team
    const isMemberOfTenant = clerkUser.organizationMemberships?.some(
      (membership) => membership.organization.id === tenantId,
    );

    if (!isMemberOfTenant) {
      throw new ForbiddenException(
        `User ${userIdToAdd} is not a member of the organization (tenant: ${tenantId}) associated with this team.`,
      );
    }

    // Important: The Team entity's 'users' relation expects instances of your local 'User' entity.
    // You still need to fetch or reference the local User entity if you're saving it directly to the 'team.users' array.
    // Option A: Fetch the local user by clerkId (if `userIdToAdd` is clerkId)
    const localUser = await this.userRepository.findOne({ where: { clerkId: userIdToAdd } });
    if (!localUser) {
      // This implies a data inconsistency if a user exists in Clerk but not locally,
      // which might need a separate sync mechanism or error handling.
      // For now, we'll assume if they are in Clerk and the target org, they should have a local record
      // or the system should be designed to handle on-the-fly creation/linking.
      throw new NotFoundException(`Local user record for Clerk ID ${userIdToAdd} not found. Data may be out of sync.`);
    }
    
    const isAlreadyMember = team.users.some(member => member.id === localUser.id); // Use localUser.id
    if (isAlreadyMember) {
      throw new BadRequestException(`User ${localUser.username || localUser.id} is already a member of team ${teamId}.`);
    }

    team.users.push(localUser);
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
