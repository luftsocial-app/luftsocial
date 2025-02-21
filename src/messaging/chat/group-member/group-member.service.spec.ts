import { Test, TestingModule } from '@nestjs/testing';
import { GroupMemberService } from './group-member.service';
import { Repository } from 'typeorm';
import { Group } from '../../../entities/group.entity';
import { GroupMember } from '../../../entities/groupMembers.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GroupMemberDto } from '../../../dto/base.dto';

const mockGroupRepository = {
  findOne: jest.fn(),
};

const mockGroupMemberRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};

describe('GroupMemberService', () => {
  let service: GroupMemberService;
  let groupRepository: Repository<Group>;
  let groupMemberRepository: Repository<GroupMember>;

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
    groupRepository = module.get<Repository<Group>>(getRepositoryToken(Group));
    groupMemberRepository = module.get<Repository<GroupMember>>(getRepositoryToken(GroupMember));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addMember', () => {
    it('should return status 2 if group is not found', async () => {
      mockGroupRepository.findOne.mockResolvedValue(null);

      const result = await service.addMember({ groupId: "1", userId: "2" } as GroupMemberDto, "1");
      expect(result).toEqual({ data: null, status: 2, message: 'Group not found.' });
    });

    it('should return status 3 if user is not an admin', async () => {
      mockGroupRepository.findOne.mockResolvedValue({ id: 1 });
      mockGroupMemberRepository.findOne.mockResolvedValue(null);

      const result = await service.addMember({ groupId: "1", userId: "2" } as GroupMemberDto, "1");
      expect(result).toEqual({ data: null, status: 3, message: 'Only admins can add members.' });
    });

    it('should return status 4 if user is already a member', async () => {
      mockGroupRepository.findOne.mockResolvedValue({ id: 1 });
      mockGroupMemberRepository.findOne
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await service.addMember({ groupId: "1", userId: "2" } as GroupMemberDto, "1");
      expect(result).toEqual({ data: null, status: 4, message: 'User is already a member.' });
    });

    it('should add a new member successfully', async () => {
      mockGroupRepository.findOne.mockResolvedValue({ id: 1 });
      mockGroupMemberRepository.findOne.mockResolvedValueOnce({});
      mockGroupMemberRepository.findOne.mockResolvedValueOnce(null);
      mockGroupMemberRepository.create.mockReturnValue({ id: 3 });
      mockGroupMemberRepository.save.mockResolvedValue({ id: 3 });

      const result = await service.addMember({ groupId: "1", userId: "2" } as GroupMemberDto, "1");
      expect(result).toEqual({ data: { id: 3 }, status: 1, message: 'User added to the group successfully.' });
    });
  });

  describe('removeMember', () => {
    it('should return status 2 if user is not a member', async () => {
      mockGroupMemberRepository.findOne.mockResolvedValue(null);

      const result = await service.removeMember("1", "2", "1");
      expect(result).toEqual({ status: 2, message: 'User is not a member of the group.' });
    });

    it('should return status 3 if user is not an admin', async () => {
      mockGroupMemberRepository.findOne
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce(null);

      const result = await service.removeMember("1", "2", "1");
      expect(result).toEqual({ status: 3, message: 'Only admins can remove members.' });
    });

    it('should remove member successfully', async () => {
      mockGroupMemberRepository.findOne.mockResolvedValue({ id: 1 });
      mockGroupMemberRepository.findOne.mockResolvedValueOnce({});
      mockGroupMemberRepository.findOne.mockResolvedValueOnce({});
      mockGroupMemberRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.removeMember("1", "2", "1");
      expect(result).toEqual({ status: 1, message: 'User removed from the group successfully.' });
    });
  });
});
