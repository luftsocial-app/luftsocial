import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GroupMemberService } from './group-member.service';
import { Group } from '../../entities/group.entity';
import { GroupMember } from '../../entities/group.members.entity';
import { GroupRole } from '../../common/enums/roles';

describe('GroupMemberService', () => {
  let service: GroupMemberService;

  const mockGroupRepository = {
    findOne: jest.fn(),
  };

  const mockGroupMemberRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupMemberService,
        {
          provide: getRepositoryToken(Group),
          useValue: mockGroupRepository,
        },
        {
          provide: getRepositoryToken(GroupMember),
          useValue: mockGroupMemberRepository,
        },
      ],
    }).compile();

    service = module.get<GroupMemberService>(GroupMemberService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addMember', () => {
    it('should add a member to group successfully', async () => {
      const mockGroup = {
        id: 1,
        tenantId: '1',
      };
      const mockAdmin = {
        id: 1,
        role: GroupRole.ADMIN,
        tenantId: '1',
        user: { id: 1 },
        group: { id: 1 },
      };
      const addMemberDto = {
        userId: '2',
        groupId: '1',
        role: GroupRole.MEMBER,
        tenantId: '1',
      };

      mockGroupRepository.findOne.mockResolvedValue(mockGroup);
      mockGroupMemberRepository.findOne
        .mockResolvedValueOnce(mockAdmin) // Admin check
        .mockResolvedValueOnce(null); // Existing member check

      const mockNewMember = {
        id: 2,
        user: { id: 2 },
        group: { id: 1 },
        role: GroupRole.MEMBER,
        status: true,
        tenantId: '1',
      };

      mockGroupMemberRepository.create.mockReturnValue(mockNewMember);
      mockGroupMemberRepository.save.mockResolvedValue(mockNewMember);

      const result = await service.addMember('1', '1', addMemberDto);

      expect(result.status).toBe(1);
      expect(result.message).toBe('User added to the group successfully.');
      expect(result.data).toEqual(mockNewMember);
    });

    it('should fail when group not found', async () => {
      // Setup
      mockGroupRepository.findOne.mockResolvedValue(null);
      const addMemberDto = {
        userId: '2',
        groupId: '1',
        role: GroupRole.MEMBER,
        tenantId: '1',
      };

      // Act
      const result = await service.addMember('1', '1', addMemberDto);

      // Assert
      expect(result).toEqual({
        status: 2, // ResponseStatus.GROUP_NOT_FOUND
        message: 'Group not found.',
        data: null,
      });

      // Verify the repository was called with correct parameters
      expect(mockGroupRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: 1,
          tenantId: 1,
        },
      });
    });
  });

  describe('removeMember', () => {
    it('should remove a member from group', async () => {
      const mockMember = {
        id: 2,
        status: true,
        tenantId: '1',
        user: { id: 2 },
        group: { id: 1 },
      };
      const mockAdmin = {
        id: 1,
        role: GroupRole.ADMIN,
        tenantId: '1',
        user: { id: 1 },
        group: { id: 1 },
      };

      mockGroupMemberRepository.findOne
        .mockResolvedValueOnce(mockMember)
        .mockResolvedValueOnce(mockAdmin);
      mockGroupMemberRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.removeMember('1', '1', '1', '2');

      expect(result.status).toBe(1);
      expect(result.message).toBe('User removed from the group successfully.');
    });

    it('should fail when member not found', async () => {
      mockGroupMemberRepository.findOne.mockResolvedValue(null);

      const result = await service.removeMember('1', '1', '1', '2');

      expect(result.status).toBe(2);
      expect(result.message).toBe('User is not a member of the group.');
    });

    it('should handle non-existent member removal', async () => {
      mockGroupMemberRepository.findOne.mockResolvedValue(null);

      const result = await service.removeMember('1', '1', '1', '2');

      expect(result.status).toBe(2);
      expect(result.message).toBe('User is not a member of the group.');
    });
  });

  describe('getGroupMembers', () => {
    it('should return group members', async () => {
      const mockMembers = [{ id: 1, user: { id: 1 } }];
      mockGroupMemberRepository.find.mockResolvedValue(mockMembers);

      const result = await service.getGroupMembers('1', '1');

      expect(result).toEqual(mockMembers);
      expect(mockGroupMemberRepository.find).toHaveBeenCalled();
    });
  });
});
