import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common'; // Removed ForbiddenException as it's not directly thrown by the service
import { TeamService } from './team.service';
import { Team } from './entities/team.entity';
import { User } from './entities/user.entity';
import { Tenant } from './entities/tenant.entity';
import { CreateTeamDto } from './dtos/team/create-team.dto';
import { UpdateTeamDto } from './dtos/team/update-team.dto';

// Mock User and Team data
const mockCreatorUserId = 'user-uuid-creator';
const mockMemberUserId = 'user-uuid-member';
const mockOtherUserId = 'user-uuid-other';
const mockTenantId = 'tenant-uuid-456';
const mockTeamId = 'team-uuid-789';

const mockUser = { id: mockMemberUserId, username: 'testuser', teams: [], activeTenantId: mockTenantId } as User;
const mockOtherUser = { id: mockOtherUserId, username: 'otheruser', teams: [], activeTenantId: mockTenantId } as User;

// Base mock team to be spread and customized in tests
const baseMockTeam = {
  id: mockTeamId,
  name: 'Test Team',
  description: 'A test team',
  tenant: { id: mockTenantId } as Tenant,
  users: [],
  createdBy: mockCreatorUserId,
  updatedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  // jest.fn() will be part of mockTeamRepository or individual entity mocks if methods are called on them
};

describe('TeamService', () => {
  let service: TeamService;
  let teamRepository: Repository<Team>;
  let userRepository: Repository<User>;

  // Deep copy of baseMockTeam for consistent fresh state in tests
  let currentMockTeam: Team;

  const mockTeamRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(), // Added for updateTeam scenario
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamService,
        {
          provide: getRepositoryToken(Team),
          useValue: mockTeamRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<TeamService>(TeamService);
    teamRepository = module.get<Repository<Team>>(getRepositoryToken(Team));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    
    // Reset mocks before each test
    jest.clearAllMocks();

    // Reset currentMockTeam for each test to avoid state leakage
    currentMockTeam = JSON.parse(JSON.stringify(baseMockTeam)); // Simple deep copy
    currentMockTeam.users = []; // Ensure users array is empty initially for each test
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTeam', () => {
    it('should successfully create a team', async () => {
      const createTeamDto: CreateTeamDto = { name: 'New Team', description: 'Desc' };
      const createdTeamEntity = { 
        ...currentMockTeam, 
        ...createTeamDto, 
        createdBy: mockCreatorUserId, 
        tenant: { id: mockTenantId }, 
        users: [] 
      };

      mockTeamRepository.create.mockReturnValue(createdTeamEntity);
      mockTeamRepository.save.mockResolvedValue(createdTeamEntity);

      const result = await service.createTeam(createTeamDto, mockTenantId, mockCreatorUserId);
      
      expect(result).toEqual(createdTeamEntity);
      expect(mockTeamRepository.create).toHaveBeenCalledWith({
        ...createTeamDto,
        tenant: { id: mockTenantId },
        createdBy: mockCreatorUserId,
        users: [],
      });
      expect(mockTeamRepository.save).toHaveBeenCalledWith(createdTeamEntity);
    });
  });

  describe('findAllByTenant', () => {
    it('should return an array of teams for a tenant', async () => {
      const teamsArray = [currentMockTeam, { ...currentMockTeam, id: 'team-uuid-002', name: 'Another Team' }];
      mockTeamRepository.find.mockResolvedValue(teamsArray);

      const result = await service.findAllByTenant(mockTenantId);
      expect(result).toEqual(teamsArray);
      expect(mockTeamRepository.find).toHaveBeenCalledWith({
        where: { tenant: { id: mockTenantId } },
        relations: ['users'],
      });
    });
  });

  describe('findById', () => {
    it('should return a team if found', async () => {
      mockTeamRepository.findOne.mockResolvedValue(currentMockTeam);
      const result = await service.findById(mockTeamId, mockTenantId);
      expect(result).toEqual(currentMockTeam);
      expect(mockTeamRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockTeamId, tenant: { id: mockTenantId } },
        relations: ['users'],
      });
    });

    it('should throw NotFoundException if team not found', async () => {
      mockTeamRepository.findOne.mockResolvedValue(null);
      await expect(service.findById('non-existent-id', mockTenantId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTeam', () => {
    it('should successfully update a team', async () => {
      const updateTeamDto: UpdateTeamDto = { name: 'Updated Team Name' };
      const updatedByUserId = 'user-updater-id';
      
      // Mock findById to return the existing team
      mockTeamRepository.findOne.mockResolvedValue(currentMockTeam); 
      
      const expectedUpdatedTeam = { 
        ...currentMockTeam, 
        ...updateTeamDto, 
        updatedBy: updatedByUserId 
      };
      mockTeamRepository.save.mockResolvedValue(expectedUpdatedTeam); // save returns the updated entity

      const result = await service.updateTeam(mockTeamId, updateTeamDto, mockTenantId, updatedByUserId);

      expect(mockTeamRepository.findOne).toHaveBeenCalledWith({
         where: { id: mockTeamId, tenant: { id: mockTenantId } },
         relations: ['users'],
      });
      expect(mockTeamRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        name: updateTeamDto.name,
        updatedBy: updatedByUserId,
      }));
      expect(result.name).toEqual(updateTeamDto.name);
      expect(result.updatedBy).toEqual(updatedByUserId);
    });

    it('should throw NotFoundException if team to update is not found', async () => {
      const updateTeamDto: UpdateTeamDto = { name: 'Updated Team Name' };
      mockTeamRepository.findOne.mockResolvedValue(null); // findById will throw
      await expect(service.updateTeam('non-existent-id', updateTeamDto, mockTenantId, mockCreatorUserId))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteTeam', () => {
    it('should successfully delete a team', async () => {
      mockTeamRepository.findOne.mockResolvedValue(currentMockTeam); // findById part
      mockTeamRepository.remove.mockResolvedValue(undefined); // remove part

      await expect(service.deleteTeam(mockTeamId, mockTenantId)).resolves.toBeUndefined();
      expect(mockTeamRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockTeamId, tenant: { id: mockTenantId } },
        relations: ['users'],
      });
      expect(mockTeamRepository.remove).toHaveBeenCalledWith(currentMockTeam);
    });

    it('should throw NotFoundException if team to delete is not found', async () => {
      mockTeamRepository.findOne.mockResolvedValue(null); // findById will throw
      await expect(service.deleteTeam('non-existent-id', mockTenantId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addMember', () => {
    beforeEach(() => {
        // Ensure the currentMockTeam starts with no users for addMember tests
        currentMockTeam.users = []; 
        mockTeamRepository.findOne.mockResolvedValue(currentMockTeam); // Common setup for findById
        mockUserRepository.findOne.mockResolvedValue(mockUser); // Common setup for finding user
        mockTeamRepository.save.mockImplementation(team => Promise.resolve(team)); // Mock save to return the modified team
    });
    
    it('should successfully add a member to a team', async () => {
      const result = await service.addMember(mockTeamId, mockMemberUserId, mockTenantId);
      
      expect(mockTeamRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockTeamId, tenant: { id: mockTenantId } },
        relations: ['users'],
      });
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: mockMemberUserId } });
      expect(mockTeamRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        users: expect.arrayContaining([mockUser]),
      }));
      expect(result.users).toContainEqual(mockUser);
    });

    it('should throw NotFoundException if team not found', async () => {
      mockTeamRepository.findOne.mockResolvedValue(null);
      await expect(service.addMember('non-existent-team-id', mockMemberUserId, mockTenantId))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user to add not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      await expect(service.addMember(mockTeamId, 'non-existent-user-id', mockTenantId))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user is already a member', async () => {
      currentMockTeam.users = [mockUser]; // User is already a member
      mockTeamRepository.findOne.mockResolvedValue(currentMockTeam);

      await expect(service.addMember(mockTeamId, mockMemberUserId, mockTenantId))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('removeMember', () => {
    beforeEach(() => {
        currentMockTeam.users = [mockUser, mockOtherUser]; // Start with members
        mockTeamRepository.findOne.mockResolvedValue(currentMockTeam);
        mockTeamRepository.save.mockImplementation(team => Promise.resolve(team));
    });

    it('should successfully remove a member from a team', async () => {
      const result = await service.removeMember(mockTeamId, mockMemberUserId, mockTenantId);
      
      expect(mockTeamRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockTeamId, tenant: { id: mockTenantId } },
        relations: ['users'],
      });
      expect(mockTeamRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        users: expect.not.arrayContaining([mockUser]),
      }));
      expect(result.users).not.toContainEqual(mockUser);
      expect(result.users).toContainEqual(mockOtherUser); // Ensure other users remain
    });

    it('should throw NotFoundException if team not found', async () => {
      mockTeamRepository.findOne.mockResolvedValue(null);
      await expect(service.removeMember('non-existent-team-id', mockMemberUserId, mockTenantId))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user to remove is not a member', async () => {
      currentMockTeam.users = [mockOtherUser]; // Target user is not in the team
      mockTeamRepository.findOne.mockResolvedValue(currentMockTeam);
      
      await expect(service.removeMember(mockTeamId, mockMemberUserId, mockTenantId))
        .rejects.toThrow(NotFoundException);
    });
  });
});
