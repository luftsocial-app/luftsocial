import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from '../../../entities/group.entity';
import { GroupMember } from '../../../entities/groupMembers.entity';
import { OperationStatus } from '../../../common/enums/operation-status.enum';
import { GroupDto, GroupMemberDto } from '../../../common/enums/messaging';

@Injectable()
export class GroupService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,
  ) {}

  async createGroup(
    groupDto: GroupDto,
    id: string,
  ): Promise<{ data: GroupDto | null; status: number }> {
    try {
      groupDto.createdBy = id ?? '1';
      const newGroup = this.groupRepository.create(groupDto);
      const data = await this.groupRepository.save(newGroup);
      const payload = {
        userId: data?.createdBy,
        role: 'admin' as 'admin' | 'member',
        groupId: data?.id,
      };
      const addGroupMember = this.groupMemberRepository.create(payload);
      await this.groupMemberRepository.save(addGroupMember);
      if (data) {
        return {
          data,
          status: OperationStatus.Success,
        };
      }
      return {
        status: OperationStatus.Failed,
        data: null,
      };
    } catch (err) {
      throw new HttpException(err.message || err, HttpStatus.BAD_REQUEST);
    }
  }

  async joinGroup(
    joinGroupDto: GroupMemberDto,
  ): Promise<{ data: GroupMemberDto | null; status: number }> {
    const { userId, groupId } = joinGroupDto;
    try {
      const group = await this.groupRepository.findOne({
        where: { id: groupId },
      });
      if (!group) {
        return {
          status: OperationStatus.NotFound,
          data: null,
        };
      }
      const existingMember = await this.groupMemberRepository.findOne({
        where: {
          // user: { id: userId },
          // group: { id: groupId },
          userId: userId,
          groupId: groupId,
        },
      });
      if (existingMember) {
        return {
          status: OperationStatus.AlreadyExists,
          data: null,
        };
      }
      const joinGroup = await this.groupMemberRepository.save(joinGroupDto);
      if (joinGroup) {
        return {
          status: OperationStatus.Success,
          data: joinGroup,
        };
      } else if (!joinGroup) {
        return {
          status: OperationStatus.Failed,
          data: null,
        };
      }
    } catch (err) {
      throw new HttpException(err.message || err, HttpStatus.BAD_REQUEST);
    }
  }
}
