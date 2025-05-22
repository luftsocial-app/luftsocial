import { Test, TestingModule } from '@nestjs/testing';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { AuthObject } from '@clerk/express';
import { PinoLogger } from 'nestjs-pino';
import { ForbiddenException, HttpStatus } from '@nestjs/common';
import { Team } from '../entities/team.entity';

// Mock PinoLogger
const mockPinoLogger = {
  setContext: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock TeamService
const mockTeamService = {
  createTeam: jest.fn(),
  getTeamsInTenant: jest.fn(),
  getTeamById: jest.fn(),
  updateTeam: jest.fn(),
  deleteTeam: jest.fn(),
  addMemberToTeam: jest.fn(),
  removeMemberFromTeam: jest.fn(),
};

const mockAuthUser = {
  claims: {
    org_id: 'tenant-uuid-1',
    sub: 'user-uuid-1', // Clerk user ID (subject)
  },
} as unknown as AuthObject; // Cast to AuthObject, only claims are used by controller

describe('TeamController', () => {
  let controller: TeamController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamController],
      providers: [
        {
          provide: TeamService,
          useValue: mockTeamService,
        },
        {
          provide: PinoLogger,
          useValue: mockPinoLogger,
        },
      ],
    }).compile();

    controller = module.get<TeamController>(TeamController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createTeam', () => {
    const createTeamDto: CreateTeamDto = {
      name: 'New Team',
      description: 'Team Desc',
    };
    const mockTeam = { id: 'team-uuid', ...createTeamDto } as Team;

    it('should call teamService.createTeam and return the created team', async () => {
      mockTeamService.createTeam.mockResolvedValue(mockTeam);
      const result = await controller.createTeam(createTeamDto, mockAuthUser);
      expect(result).toEqual(mockTeam);
      expect(mockTeamService.createTeam).toHaveBeenCalledWith(
        createTeamDto,
        mockAuthUser.claims.org_id,
        mockAuthUser.claims.sub,
      );
    });

    it('should throw ForbiddenException if org_id is missing from claims', async () => {
      const authUserNoOrg = {
        claims: { sub: 'user-uuid-1' },
      } as unknown as AuthObject;
      await expect(
        controller.createTeam(createTeamDto, authUserNoOrg),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getTeamsInTenant', () => {
    const mockTeams = [{ id: 'team1', name: 'Team One' }] as Team[];
    it('should call teamService.getTeamsInTenant and return teams', async () => {
      mockTeamService.getTeamsInTenant.mockResolvedValue(mockTeams);
      const result = await controller.getTeamsInTenant(mockAuthUser);
      expect(result).toEqual(mockTeams);
      expect(mockTeamService.getTeamsInTenant).toHaveBeenCalledWith(
        mockAuthUser.claims.org_id,
      );
    });
  });

  describe('getTeamById', () => {
    const teamId = 'team-uuid-target';
    const mockTeam = { id: teamId, name: 'Target Team' } as Team;
    it('should call teamService.getTeamById and return the team', async () => {
      mockTeamService.getTeamById.mockResolvedValue(mockTeam);
      const result = await controller.getTeamById(teamId, mockAuthUser);
      expect(result).toEqual(mockTeam);
      expect(mockTeamService.getTeamById).toHaveBeenCalledWith(
        teamId,
        mockAuthUser.claims.org_id,
      );
    });
  });

  describe('updateTeam', () => {
    const teamId = 'team-uuid-to-update';
    const updateTeamDto: UpdateTeamDto = { name: 'Updated Name' };
    const mockUpdatedTeam = { id: teamId, ...updateTeamDto } as Team;
    it('should call teamService.updateTeam and return the updated team', async () => {
      mockTeamService.updateTeam.mockResolvedValue(mockUpdatedTeam);
      const result = await controller.updateTeam(
        teamId,
        updateTeamDto,
        mockAuthUser,
      );
      expect(result).toEqual(mockUpdatedTeam);
      expect(mockTeamService.updateTeam).toHaveBeenCalledWith(
        teamId,
        updateTeamDto,
        mockAuthUser.claims.org_id,
      );
    });
  });

  describe('deleteTeam', () => {
    const teamId = 'team-uuid-to-delete';
    it('should call teamService.deleteTeam', async () => {
      mockTeamService.deleteTeam.mockResolvedValue(undefined); // Simulates void return
      // HttpCode is NO_CONTENT, so controller method itself returns void/undefined
      await controller.deleteTeam(teamId, mockAuthUser);
      expect(mockTeamService.deleteTeam).toHaveBeenCalledWith(
        teamId,
        mockAuthUser.claims.org_id,
      );
    });
  });

  describe('addMemberToTeam', () => {
    const teamId = 'team-uuid-add-member';
    const addMemberDto: AddTeamMemberDto = { userId: 'new-member-uuid' };
    const mockTeamWithNewMember = {
      id: teamId,
      users: [{ id: addMemberDto.userId }],
    } as Team;

    it('should call teamService.addMemberToTeam and return the updated team', async () => {
      mockTeamService.addMemberToTeam.mockResolvedValue(mockTeamWithNewMember);
      const result = await controller.addMemberToTeam(
        teamId,
        addMemberDto,
        mockAuthUser,
      );
      expect(result).toEqual(mockTeamWithNewMember);
      expect(mockTeamService.addMemberToTeam).toHaveBeenCalledWith(
        teamId,
        addMemberDto.userId,
        mockAuthUser.claims.org_id,
      );
    });
  });

  describe('removeMemberFromTeam', () => {
    const teamId = 'team-uuid-remove-member';
    const memberToRemoveId = 'member-to-remove-uuid';
    const mockTeamAfterRemoval = { id: teamId, users: [] } as Team;

    it('should call teamService.removeMemberFromTeam and return the updated team', async () => {
      mockTeamService.removeMemberFromTeam.mockResolvedValue(
        mockTeamAfterRemoval,
      );
      const result = await controller.removeMemberFromTeam(
        teamId,
        memberToRemoveId,
        mockAuthUser,
      );
      expect(result).toEqual(mockTeamAfterRemoval);
      expect(mockTeamService.removeMemberFromTeam).toHaveBeenCalledWith(
        teamId,
        memberToRemoveId,
        mockAuthUser.claims.org_id,
      );
    });
  });
});
