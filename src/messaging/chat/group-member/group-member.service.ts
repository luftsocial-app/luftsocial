import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from '../../../entities/group.entity';
import { GroupDto, GroupMemberDto } from '../../../dto/base.dto';
import { GroupMember } from '../../../entities/groupMembers.entity';
import { User } from '../../../entities/users/user.entity';
import { OperationStatus } from '../../../common/enums/operation-status.enum';

@Injectable()
export class GroupMemberService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,
  ) {}

  async addMember(
    groupMemberDto: GroupMemberDto,
    userId: string,
  ): Promise<{ data: GroupMember | null; status: number; message: string }> {
    try {
      const { userId, groupId } = groupMemberDto;
      const group = await this.groupRepository.findOne({
        where: { id: groupId },
      });
      if (!group) {
        return {
          data: null,
          status: OperationStatus.NotFound,
          message: 'Group not found.',
        };
      }
      const admin = await this.groupMemberRepository.findOne({
        where: { user: { id: userId }, group: { id: groupId }, role: 'admin' },
      });
      if (!admin) {
        return {
          data: null,
          status: OperationStatus.Unauthorized,
          message: 'Only admins can add members.',
        };
      }
      const existingMember = await this.groupMemberRepository.findOne({
        where: { user: { id: userId }, group: { id: groupId } },
      });
      if (existingMember) {
        return {
          data: null,
          status: OperationStatus.AlreadyExists,
          message: 'User is already a member.',
        };
      }
      const newMember = this.groupMemberRepository.create({
        user: { id: userId },
        group: { id: groupId },
        role: 'member',
      });

      const savedMember = await this.groupMemberRepository.save(newMember);
      if (savedMember) {
        return {
          data: savedMember,
          status: OperationStatus.Success,
          message: 'User added to the group successfully.',
        };
      }
      return {
        data: null,
        status: OperationStatus.Failed,
        message: 'Failed to add user to the group.',
      };
    } catch (err) {
      throw new HttpException(err.message || err, HttpStatus.BAD_REQUEST);
    }
  }

  async removeMember(
    groupId: string,
    userId: string,
    id: string,
  ): Promise<{ status: number; message: string }> {
    try {
      const member = await this.groupMemberRepository.findOne({
        where: { user: { id: userId }, group: { id: groupId }, status: true },
      });
      if (!member) {
        return {
          status: OperationStatus.NotAMember,
          message: 'User is not a member of the group.',
        };
      }
      const admin = await this.groupMemberRepository.findOne({
        where: { user: { id: id }, group: { id: groupId }, role: 'admin' },
      });
      if (!admin) {
        return {
          status: OperationStatus.Unauthorized,
          message: 'Only admins can remove members.',
        };
      }
      const deleteMember = await this.groupMemberRepository.update(member.id, {
        status: false,
      });
      if (deleteMember) {
        return {
          status: OperationStatus.Success,
          message: 'User removed from the group successfully.',
        };
      }
      return {
        status: OperationStatus.Failed,
        message: 'Failed to remove user from the group. Please try again.',
      };
    } catch (err) {
      throw new HttpException(err.message || err, HttpStatus.BAD_REQUEST);
    }
  }
}
