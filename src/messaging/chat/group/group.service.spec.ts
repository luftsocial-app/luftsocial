import { Test, TestingModule } from '@nestjs/testing';
import { GroupService } from './group.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Group } from '../../../entities/group.entity';
import { GroupMember } from '../../../entities/groupMembers.entity';
import { Repository } from 'typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('GroupService', () => {
  let service: GroupService;
  let groupRepository: Repository<Group>;
  let groupMemberRepository: Repository<GroupMember>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupService,
        {
          provide: getRepositoryToken(Group),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(GroupMember),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<GroupService>(GroupService);
    groupRepository = module.get<Repository<Group>>(getRepositoryToken(Group));
    groupMemberRepository = module.get<Repository<GroupMember>>(
      getRepositoryToken(GroupMember),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createGroup', () => {
    it('should successfully create a group', async () => {
      const groupDto = { name: 'Test Group', description: 'Test Description' };
      const userId = "1";

      jest.spyOn(groupRepository, 'create').mockImplementation((dto) => dto as Group);
      jest.spyOn(groupRepository, 'save').mockResolvedValue({
        id: "1",
        ...groupDto,
        createdBy: userId,
      } as Group);

      jest.spyOn(groupMemberRepository, 'create').mockImplementation((dto) => dto as GroupMember);
      jest.spyOn(groupMemberRepository, 'save').mockResolvedValue({
        userId,
        groupId: "1",
        // role: 'admin',
      } as GroupMember);

      const result = await service.createGroup(groupDto, userId);

      expect(groupRepository.create).toHaveBeenCalled();
      expect(groupRepository.save).toHaveBeenCalled();
      expect(groupMemberRepository.create).toHaveBeenCalled();
      expect(groupMemberRepository.save).toHaveBeenCalled();
      expect(result.status).toBe(1);
    });
  });

  describe('joinGroup', () => {
    it('should successfully join a group', async () => {
      const joinGroupDto = { userId: "1", groupId: "1" };

      jest
        .spyOn(groupRepository, 'findOne')
        .mockResolvedValue({ id: "1" } as Group);
      jest.spyOn(groupMemberRepository, 'findOne').mockResolvedValue(null);
      const groupMemberSave = jest
        .spyOn(groupMemberRepository, 'save')
        .mockResolvedValue({
          ...joinGroupDto,
          role: 'member',
        } as GroupMember);

      const result = await service.joinGroup(joinGroupDto);
      expect(groupMemberSave).toHaveBeenCalled();
      expect(result.status).toBe(1);
    });

    it('should fail to join a group because group not found', async () => {
      const joinGroupDto = { userId: "1", groupId: "1" };

      jest.spyOn(groupRepository, 'findOne').mockResolvedValue(null);

      const result = await service.joinGroup(joinGroupDto);
      expect(result.status).toBe(2);
    });

    it('should fail to join a group because already a member', async () => {
      const joinGroupDto = { userId: "1", groupId: "1" };

      jest
        .spyOn(groupRepository, 'findOne')
        .mockResolvedValue({ id: "1" } as Group);
      jest
        .spyOn(groupMemberRepository, 'findOne')
        .mockResolvedValue({ userId: "1", groupId: "1" } as GroupMember);

      const result = await service.joinGroup(joinGroupDto);
      expect(result.status).toBe(3);
    });
  });
});
