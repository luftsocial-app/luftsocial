import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'; // Added ForbiddenException
import { TeamService } from './team.service';
import { Team } from './entities/team.entity';
import { CLERK_CLIENT } from '../clerk/clerk.provider'; // Added
import { ClerkClient } from '@clerk/backend'; // Added
import { User } from './entities/user.entity';
import { Tenant } from './entities/tenant.entity';
import { CreateTeamDto } from './dtos/team/create-team.dto';
import { UpdateTeamDto } from './dtos/team/update-team.dto';

// Mock User and Team data
const mockCreatorUserId = 'user-uuid-creator'; // This is likely a local DB user ID
const mockOldMemberLocalDbId = 'local-db-id-old-member'; // Example local DB ID for an existing user
const mockOtherLocalDbId = 'local-db-id-other-member'; // Example local DB ID for another user

const mockUserIdToAddViaClerk = 'clerk-user-id-to-add'; // This is a Clerk User ID
const mockLocalUserCorrespToClerkId = { 
  id: 'local-db-id-for-clerk-user', // Local DB primary key
  clerkId: mockUserIdToAddViaClerk, 
  username: 'addedUserViaClerk', 
  teams: [], 
  activeTenantId: mockTenantId 
} as User;

const mockTenantId = 'tenant-uuid-456'; // Clerk Organization ID
const mockTeamId = 'team-uuid-789';


// Kept for other tests like removeMember, assuming they use local DB IDs
const mockUser = { id: mockOldMemberLocalDbId, clerkId: 'clerk-id-for-old-member', username: 'testuser', teams: [], activeTenantId: mockTenantId } as User;
const mockOtherUser = { id: mockOtherLocalDbId, clerkId: 'clerk-id-for-other-member', username: 'otheruser', teams: [], activeTenantId: mockTenantId } as User;

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
  // let clerkClient: ClerkClient; // Not strictly needed to type the mock instance itself

  // Deep copy of baseMockTeam for consistent fresh state in tests
  let currentMockTeam: Team;

  const mockTeamRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockClerkClient = { // Added
    users: {
      getUser: jest.fn(),
    },
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
        { // Added ClerkClient mock provider
          provide: CLERK_CLIENT,
          useValue: mockClerkClient,
        },
      ],
    }).compile();

    service = module.get<TeamService>(TeamService);
    teamRepository = module.get<Repository<Team>>(getRepositoryToken(Team));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    // clerkClient = module.get<ClerkClient>(CLERK_CLIENT); // Can be used to access the mock if needed

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
    // mockUserIdToAddViaClerk, mockLocalUserCorrespToClerkId, mockTenantId, mockTeamId are defined above
    const mockClerkUserFound = {
      id: mockUserIdToAddViaClerk,
      organizationMemberships: [{ organization: { id: mockTenantId }, role: 'member' }],
    };

    beforeEach(() => {
      // Reset team state for each addMember test
      currentMockTeam.users = []; 
      
      // Common mocks that might be overridden in specific tests
      mockTeamRepository.findOne.mockResolvedValue(currentMockTeam);
      mockClerkClient.users.getUser.mockResolvedValue(mockClerkUserFound);
      mockUserRepository.findOne.mockResolvedValue(mockLocalUserCorrespToClerkId);
      // mockTeamRepository.save.mockImplementation(team => Promise.resolve(team)); // More flexible save mock
      mockTeamRepository.save.mockImplementation(async (team: Team) => team);


    });
    
    it('should successfully add a member to a team', async () => {
      const result = await service.addMember(mockTeamId, mockUserIdToAddViaClerk, mockTenantId);
      
      expect(mockTeamRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockTeamId, tenant: { id: mockTenantId } },
        relations: ['users'],
      });
      expect(mockClerkClient.users.getUser).toHaveBeenCalledWith(mockUserIdToAddViaClerk);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { clerkId: mockUserIdToAddViaClerk } });
      expect(mockTeamRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        users: expect.arrayContaining([mockLocalUserCorrespToClerkId]),
      }));
      expect(result.users).toContainEqual(mockLocalUserCorrespToClerkId);
    });

    it('should throw NotFoundException if team not found', async () => {
      mockTeamRepository.findOne.mockResolvedValue(null); // Team not found
      await expect(service.addMember('non-existent-team-id', mockUserIdToAddViaClerk, mockTenantId))
        .rejects.toThrow(new NotFoundException(`Team with ID non-existent-team-id not found in this tenant.`));
    });

    it('should throw NotFoundException if user not found in Clerk', async () => {
      mockClerkClient.users.getUser.mockRejectedValue(new Error('Clerk: User not found'));
      await expect(service.addMember(mockTeamId, mockUserIdToAddViaClerk, mockTenantId))
        .rejects.toThrow(new NotFoundException(`User with ID ${mockUserIdToAddViaClerk} not found via Clerk.`));
    });

    it('should throw ForbiddenException if Clerk user is not a member of the tenant', async () => {
      mockClerkClient.users.getUser.mockResolvedValue({
        ...mockClerkUserFound,
        organizationMemberships: [{ organization: { id: 'other-tenant-id' }, role: 'member' }],
      });
      await expect(service.addMember(mockTeamId, mockUserIdToAddViaClerk, mockTenantId))
        .rejects.toThrow(new ForbiddenException(`User ${mockUserIdToAddViaClerk} is not a member of the organization (tenant: ${mockTenantId}) associated with this team.`));
    });
    
    it('should throw NotFoundException if local user record not found for a valid Clerk user', async () => {
      mockUserRepository.findOne.mockResolvedValue(null); // Local user not found
      await expect(service.addMember(mockTeamId, mockUserIdToAddViaClerk, mockTenantId))
        .rejects.toThrow(new NotFoundException(`Local user record for Clerk ID ${mockUserIdToAddViaClerk} not found. Data may be out of sync.`));
    });

    it('should throw BadRequestException if user is already a member', async () => {
      currentMockTeam.users = [mockLocalUserCorrespToClerkId]; // User is already a member
      mockTeamRepository.findOne.mockResolvedValue(currentMockTeam);
      // Other mocks (Clerk user, local user) should still resolve successfully
      mockClerkClient.users.getUser.mockResolvedValue(mockClerkUserFound);
      mockUserRepository.findOne.mockResolvedValue(mockLocalUserCorrespToClerkId);

      await expect(service.addMember(mockTeamId, mockUserIdToAddViaClerk, mockTenantId))
        .rejects.toThrow(new BadRequestException(`User ${mockLocalUserCorrespToClerkId.username || mockLocalUserCorrespToClerkId.id} is already a member of team ${mockTeamId}.`));
    });
  });

  // Tests for removeMember might need adjustment if userIdToRemove is a Clerk ID
  // For now, assuming removeMember still operates on local DB user IDs (as per current service code)
  describe('removeMember', () => {
    beforeEach(() => {
        // Using the old mockUser and mockOtherUser which have local DB IDs
        currentMockTeam.users = [mockUser, mockOtherUser]; 
        mockTeamRepository.findOne.mockResolvedValue(currentMockTeam);
        mockTeamRepository.save.mockImplementation(async (team: Team) => team);
    });

    it('should successfully remove a member from a team', async () => {
      // removeMember expects the local DB user ID
      const result = await service.removeMember(mockTeamId, mockUser.id, mockTenantId); 
      
      expect(mockTeamRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockTeamId, tenant: { id: mockTenantId } },
        relations: ['users'],
      });
      expect(mockTeamRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        users: expect.not.arrayContaining([mockUser]),
      }));
      expect(result.users).not.toContainEqual(mockUser);
      expect(result.users).toContainEqual(mockOtherUser);
    });

    it('should throw NotFoundException if team not found (when trying to remove member)', async () => {
      mockTeamRepository.findOne.mockResolvedValue(null);
      await expect(service.removeMember('non-existent-team-id', mockUser.id, mockTenantId))
        .rejects.toThrow(new NotFoundException(`Team with ID non-existent-team-id not found in this tenant.`));
    });

    it('should throw NotFoundException if user to remove is not a member (using local DB ID)', async () => {
      currentMockTeam.users = [mockOtherUser]; // mockUser (target for removal) is not in the team
      mockTeamRepository.findOne.mockResolvedValue(currentMockTeam);
      
      await expect(service.removeMember(mockTeamId, mockUser.id, mockTenantId))
        .rejects.toThrow(new NotFoundException(`User ${mockUser.id} is not a member of team ${mockTeamId}.`));
    });
  });
});
