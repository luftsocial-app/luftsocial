import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AddMemberDto, UpdateMemberRoleDto } from './dto/group-member.dto';
import { ResponseStatus } from '../../common/enums/messaging';
import { Group } from '../../entities/group.entity';
import { GroupMember } from '../../entities/group.members.entity';
import { GroupRole } from '../../common/enums/roles';

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

    const numGroupId = Number(groupId);
    const numTenantId = Number(tenantId);
    const numUserId = Number(userId);
    const numId = Number(id);

    const group = await this.groupRepository.findOne({
      where: {
        id: numGroupId,
        tenantId: numTenantId,
      } as any,
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
        user: { id: numId },
        group: { id: numGroupId },
        role: GroupRole.ADMIN,
        tenantId: numTenantId,
      } as any,
    });
    if (!admin) {
      return {
        data: null,
        status: 3,
        message: 'Only admins can add members.',
      };
    }
    const existingMember = await this.groupMemberRepository.findOne({
      where: {
        user: { id: numUserId },
        group: { id: numGroupId },
        tenantId: numTenantId,
      } as any,
    });
    if (existingMember) {
      return {
        data: null,
        status: 4,
        message: 'User is already a member.',
      };
    }
    const memberData = {
      user: { id: numUserId },
      group: { id: numGroupId },
      role: role || GroupRole.MEMBER,
      tenantId: numTenantId,
      status: true,
    };

    const newMember = this.groupMemberRepository.create(
      memberData as unknown as GroupMember,
    );
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
          user: { id: Number(userId) },
          group: { id: Number(groupId) },
          status: true,
          tenantId: Number(tenantId),
        } as any,
      });
      if (!member) {
        return {
          status: 2,
          message: 'User is not a member of the group.',
        };
      }
      const admin = await this.groupMemberRepository.findOne({
        where: {
          user: { id: Number(adminId) },
          group: { id: Number(groupId) },
          role: GroupRole.ADMIN,
          tenantId: Number(tenantId),
        } as any,
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
    console.log({ adminId, tenantId, groupId, updateRoleDto });

    // Add tenantId to all queries
    // ...existing code with similar number conversions if needed...
  }

  async getGroupMembers(groupId: string, tenantId: string) {
    return await this.groupMemberRepository.find({
      where: {
        group: { id: Number(groupId) },
        tenantId: Number(tenantId),
      } as any,
      relations: ['user'],
    });
  }
}
