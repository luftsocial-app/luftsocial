import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from '../entities/group.entity';
import { GroupMember } from 'src/entities/groupMembers.entity';
import { AddMemberDto, UpdateMemberRoleDto } from './dto/group-member.dto';
import { GroupRole, ResponseStatus } from '../types/enums';

@Injectable()
export class GroupMemberService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,
  ) {}

  async addMember(id: string, tenantId: string, addMemberDto: AddMemberDto) {
    const { userId, groupId, role } = addMemberDto;

    const group = await this.groupRepository.findOne({
      where: { id: groupId, tenantId },
    });
    if (!group) {
      return {
        data: null,
        status: ResponseStatus.GROUP_NOT_FOUND,
        message: 'Group not found.',
      };
    }
    const admin = await this.groupMemberRepository.findOne({
      where: {
        user: { id: id },
        group: { id: groupId },
        role: GroupRole.ADMIN,
        tenantId,
      },
    });
    if (!admin) {
      return {
        data: null,
        status: 3,
        message: 'Only admins can add members.',
      };
    }
    const existingMember = await this.groupMemberRepository.findOne({
      where: { user: { id: userId }, group: { id: groupId }, tenantId },
    });
    if (existingMember) {
      return {
        data: null,
        status: 4,
        message: 'User is already a member.',
      };
    }
    const newMember = this.groupMemberRepository.create({
      user: { id: userId },
      group: { id: groupId },
      role: role || GroupRole.MEMBER,
      tenantId,
    });
    console.log(newMember, 'Member created');

    const savedMember = await this.groupMemberRepository.save(newMember);
    if (savedMember) {
      return {
        data: savedMember,
        status: 1,
        message: 'User added to the group successfully.',
      };
    }
    return {
      data: null,
      status: 0,
      message: 'Failed to add user to the group.',
    };
  }

  async removeMember(
    adminId: string,
    tenantId: string,
    groupId: string,
    userId: string,
  ): Promise<{ status: number; message: string }> {
    try {
      const member = await this.groupMemberRepository.findOne({
        where: {
          user: { id: userId },
          group: { id: groupId },
          status: true,
          tenantId,
        },
      });
      if (!member) {
        return {
          status: 2,
          message: 'User is not a member of the group.',
        };
      }
      const admin = await this.groupMemberRepository.findOne({
        where: {
          user: { id: adminId },
          group: { id: groupId },
          role: GroupRole.ADMIN,
          tenantId,
        },
      });
      if (!admin) {
        return {
          status: 3,
          message: 'Only admins can remove members.',
        };
      }
      const deleteMember = await this.groupMemberRepository.update(member.id, {
        status: false,
      });
      if (deleteMember) {
        return {
          status: 1,
          message: 'User removed from the group successfully.',
        };
      }
      return {
        status: 0,
        message: 'Failed to remove user from the group. Please try again.',
      };
    } catch (err) {
      throw new HttpException(err.message || err, HttpStatus.BAD_REQUEST);
    }
  }

  async updateMemberRole(
    adminId: string,
    tenantId: string,
    groupId: string,
    updateRoleDto: UpdateMemberRoleDto,
  ) {
    // Add tenantId to all queries
    // ...existing code...
  }

  async getGroupMembers(groupId: string, tenantId: string) {
    return await this.groupMemberRepository.find({
      where: { group: { id: groupId }, tenantId },
      relations: ['user'],
    });
  }
}
