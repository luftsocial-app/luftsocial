import { Test, TestingModule } from '@nestjs/testing';
import { TeamService } from './team.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '../entities/team.entity';
import { User } from '../entities/user.entity';
import { Tenant } from '../entities/tenant.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { PinoLogger } from 'nestjs-pino';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

// Mock PinoLogger
const mockPinoLogger = {
  setContext: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('TeamService', () => {
  let service: TeamService;
  let teamRepository: Repository<Team>;
  let userRepository: Repository<User>;
  let tenantRepository: Repository<Tenant>;

  const mockTeamId = 'team-uuid-1';
  const mockTenantId = 'tenant-uuid-1';
  const mockUserId = 'user-uuid-1';
  const mockCreatorId = 'creator-uuid-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamService,
        {
          provide: getRepositoryToken(Team),
          useClass: Repository, // Using actual Repository class but methods will be spied/mocked
        },
        {
          provide: getRepositoryToken(User),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(Tenant),
          useClass: Repository,
        },
        {
          provide: PinoLogger,
          useValue: mockPinoLogger,
        },
      ],
    }).compile();

    service = module.get<TeamService>(TeamService);
    teamRepository = module.get<Repository<Team>>(getRepositoryToken(Team));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    tenantRepository = module.get<Repository<Tenant>>(getRepositoryToken(Tenant));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTeam', () => {
    const createTeamDto: CreateTeamDto = { name: 'Test Team', description: 'A test team' };
    let mockTenant: Tenant;
    let mockCreator: User;
    let mockTeam: Team;

    beforeEach(() => {
      mockTenant = { id: mockTenantId, name: 'Test Tenant' } as Tenant;
      mockCreator = { id: mockCreatorId, firstName: 'Creator', activeTenantId: mockTenantId } as User;
      mockTeam = { ...createTeamDto, id: mockTeamId, tenant: mockTenant, users: [mockCreator], createdBy: mockCreator } as Team;

      jest.spyOn(tenantRepository, 'findOne').mockResolvedValue(mockTenant);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockCreator);
      jest.spyOn(teamRepository, 'create').mockReturnValue(mockTeam);
      jest.spyOn(teamRepository, 'save').mockResolvedValue(mockTeam);
    });

    it('should create a team successfully', async () => {
      const result = await service.createTeam(createTeamDto, mockTenantId, mockCreatorId);
      expect(result).toEqual(mockTeam);
      expect(tenantRepository.findOne).toHaveBeenCalledWith({ where: { id: mockTenantId } });
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: mockCreatorId, activeTenantId: mockTenantId } });
      expect(teamRepository.create).toHaveBeenCalledWith({
        ...createTeamDto,
        tenant: mockTenant,
        users: [mockCreator],
        createdBy: mockCreator,
      });
      expect(teamRepository.save).toHaveBeenCalledWith(mockTeam);
    });

    it('should throw NotFoundException if tenant not found', async () => {
      jest.spyOn(tenantRepository, 'findOne').mockResolvedValue(null);
      await expect(service.createTeam(createTeamDto, 'wrong-tenant-id', mockCreatorId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if creator not found in tenant', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      await expect(service.createTeam(createTeamDto, mockTenantId, 'wrong-creator-id')).rejects.toThrow(NotFoundException);
    });
    
    it('should throw BadRequestException on repository save error', async () => {
      jest.spyOn(teamRepository, 'save').mockRejectedValue(new Error('DB error'));
      await expect(service.createTeam(createTeamDto, mockTenantId, mockCreatorId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTeamById', () => {
    let mockTeam: Team;
    beforeEach(() => {
        mockTeam = { id: mockTeamId, name: 'Found Team', tenant: { id: mockTenantId } as Tenant } as Team;
        jest.spyOn(teamRepository, 'findOne').mockResolvedValue(mockTeam);
    });

    it('should return a team if found in tenant', async () => {
      const result = await service.getTeamById(mockTeamId, mockTenantId);
      expect(result).toEqual(mockTeam);
      expect(teamRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockTeamId, tenant: { id: mockTenantId } },
        relations: ['users', 'tenant', 'createdBy'],
      });
    });

    it('should throw NotFoundException if team not found', async () => {
      jest.spyOn(teamRepository, 'findOne').mockResolvedValue(null);
      await expect(service.getTeamById('wrong-team-id', mockTenantId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTeamsInTenant', () => {
    let mockTeams: Team[];
    let mockTenant: Tenant;
    beforeEach(() => {
        mockTenant = { id: mockTenantId, name: 'Test Tenant'} as Tenant;
        mockTeams = [{ id: mockTeamId, name: 'Team 1', tenant: mockTenant } as Team];
        jest.spyOn(tenantRepository, 'findOne').mockResolvedValue(mockTenant);
        jest.spyOn(teamRepository, 'find').mockResolvedValue(mockTeams);
    });

    it('should return an array of teams for a tenant', async () => {
      const result = await service.getTeamsInTenant(mockTenantId);
      expect(result).toEqual(mockTeams);
      expect(tenantRepository.findOne).toHaveBeenCalledWith({ where: { id: mockTenantId } });
      expect(teamRepository.find).toHaveBeenCalledWith({
        where: { tenant: { id: mockTenantId } },
        relations: ['users', 'createdBy'],
      });
    });
    
    it('should throw NotFoundException if tenant not found', async () => {
      jest.spyOn(tenantRepository, 'findOne').mockResolvedValue(null);
      await expect(service.getTeamsInTenant('wrong-tenant-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTeam', () => {
    const updateTeamDto: UpdateTeamDto = { name: 'Updated Team Name' };
    let mockExistingTeam: Team;
    let mockUpdatedTeamData: Team;

    beforeEach(() => {
      mockExistingTeam = { id: mockTeamId, name: 'Old Name', tenant: { id: mockTenantId } as Tenant } as Team;
      mockUpdatedTeamData = { ...mockExistingTeam, ...updateTeamDto };
      // Mock getTeamById behavior via findOne
      jest.spyOn(teamRepository, 'findOne').mockResolvedValue(mockExistingTeam);
      jest.spyOn(teamRepository, 'save').mockResolvedValue(mockUpdatedTeamData);
    });

    it('should update a team successfully', async () => {
      const result = await service.updateTeam(mockTeamId, updateTeamDto, mockTenantId);
      expect(result.name).toEqual(updateTeamDto.name);
      expect(teamRepository.findOne).toHaveBeenCalledWith({ // from getTeamById call
        where: { id: mockTeamId, tenant: { id: mockTenantId } },
        relations: ['users', 'tenant', 'createdBy'],
      });
      expect(teamRepository.save).toHaveBeenCalledWith(expect.objectContaining(updateTeamDto));
    });

    it('should throw NotFoundException if team to update is not found', async () => {
      jest.spyOn(teamRepository, 'findOne').mockResolvedValue(null);
      await expect(service.updateTeam('wrong-team-id', updateTeamDto, mockTenantId)).rejects.toThrow(NotFoundException);
    });
    
    it('should throw BadRequestException on save error during update', async () => {
      jest.spyOn(teamRepository, 'save').mockRejectedValue(new Error('DB error'));
      await expect(service.updateTeam(mockTeamId, updateTeamDto, mockTenantId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteTeam', () => {
    let mockTeamToDelete: Team;
    beforeEach(() => {
        mockTeamToDelete = { id: mockTeamId, name: 'Team to Delete', tenant: { id: mockTenantId } as Tenant } as Team;
        jest.spyOn(teamRepository, 'findOne').mockResolvedValue(mockTeamToDelete); // for getTeamById
        jest.spyOn(teamRepository, 'remove').mockResolvedValue(mockTeamToDelete); // remove returns the removed entity or void
    });

    it('should delete a team successfully', async () => {
      await service.deleteTeam(mockTeamId, mockTenantId);
      expect(teamRepository.findOne).toHaveBeenCalledWith({ // from getTeamById
        where: { id: mockTeamId, tenant: { id: mockTenantId } },
        relations: ['users', 'tenant', 'createdBy'],
      });
      expect(teamRepository.remove).toHaveBeenCalledWith(mockTeamToDelete);
    });

    it('should throw NotFoundException if team to delete is not found', async () => {
      jest.spyOn(teamRepository, 'findOne').mockResolvedValue(null);
      await expect(service.deleteTeam('wrong-team-id', mockTenantId)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException on remove error during delete', async () => {
      jest.spyOn(teamRepository, 'remove').mockRejectedValue(new Error('DB error'));
      await expect(service.deleteTeam(mockTeamId, mockTenantId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('addMemberToTeam', () => {
    let mockTeam: Team;
    let mockUserToAdd: User;

    beforeEach(() => {
      mockTeam = { id: mockTeamId, name: 'Team', tenant: { id: mockTenantId } as Tenant, users: [] } as Team;
      mockUserToAdd = { id: mockUserId, firstName: 'New Member', activeTenantId: mockTenantId } as User;
      
      jest.spyOn(teamRepository, 'findOne').mockResolvedValue(mockTeam); // For getTeamById
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUserToAdd);
      jest.spyOn(teamRepository, 'save').mockImplementation(async (team: Team) => team); // Return the modified team
    });

    it('should add a member to a team successfully', async () => {
      const result = await service.addMemberToTeam(mockTeamId, mockUserId, mockTenantId);
      expect(result.users).toContainEqual(mockUserToAdd);
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: mockUserId } });
      expect(teamRepository.save).toHaveBeenCalledWith(mockTeam);
    });

    it('should throw NotFoundException if team not found', async () => {
      jest.spyOn(teamRepository, 'findOne').mockResolvedValue(null);
      await expect(service.addMemberToTeam('wrong-team-id', mockUserId, mockTenantId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user to add not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      await expect(service.addMemberToTeam(mockTeamId, 'wrong-user-id', mockTenantId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not belong to team\'s tenant', async () => {
      mockUserToAdd.activeTenantId = 'different-tenant-id';
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUserToAdd);
      await expect(service.addMemberToTeam(mockTeamId, mockUserId, mockTenantId)).rejects.toThrow(ForbiddenException);
    });
    
    it('should not add user if already a member (and return team)', async () => {
        mockTeam.users = [mockUserToAdd]; // User already in team
        jest.spyOn(teamRepository, 'findOne').mockResolvedValue(mockTeam);
        const result = await service.addMemberToTeam(mockTeamId, mockUserId, mockTenantId);
        expect(result.users.length).toBe(1); // Length should remain 1
        expect(teamRepository.save).not.toHaveBeenCalled(); // Save should not be called if no change
    });

    it('should throw BadRequestException on save error', async () => {
        jest.spyOn(teamRepository, 'save').mockRejectedValue(new Error('DB error'));
        await expect(service.addMemberToTeam(mockTeamId, mockUserId, mockTenantId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeMemberFromTeam', () => {
    let mockTeamWithMember: Team;
    let mockMemberToRemove: User;

    beforeEach(() => {
      mockMemberToRemove = { id: mockUserId, firstName: 'Member to Remove' } as User;
      mockTeamWithMember = { 
        id: mockTeamId, 
        name: 'Team', 
        tenant: { id: mockTenantId } as Tenant, 
        users: [mockMemberToRemove, { id: 'other-user-uuid' } as User] 
      } as Team;

      jest.spyOn(teamRepository, 'findOne').mockResolvedValue(mockTeamWithMember); // For getTeamById
      jest.spyOn(teamRepository, 'save').mockImplementation(async (team: Team) => team);
    });

    it('should remove a member from a team successfully', async () => {
      const result = await service.removeMemberFromTeam(mockTeamId, mockUserId, mockTenantId);
      expect(result.users.find(u => u.id === mockUserId)).toBeUndefined();
      expect(result.users.length).toBe(1);
      expect(teamRepository.save).toHaveBeenCalledWith(mockTeamWithMember);
    });

    it('should throw NotFoundException if team not found', async () => {
      jest.spyOn(teamRepository, 'findOne').mockResolvedValue(null);
      await expect(service.removeMemberFromTeam('wrong-team-id', mockUserId, mockTenantId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user to remove is not in the team', async () => {
      await expect(service.removeMemberFromTeam(mockTeamId, 'non-existent-user-id', mockTenantId)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException on save error', async () => {
        jest.spyOn(teamRepository, 'save').mockRejectedValue(new Error('DB error'));
        await expect(service.removeMemberFromTeam(mockTeamId, mockUserId, mockTenantId)).rejects.toThrow(BadRequestException);
    });
  });
});
