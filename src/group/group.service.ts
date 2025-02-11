import { Injectable, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from '../entities/group.entity';
import { GroupMember } from '../entities/groupMembers.entity';
import { TenantService } from '../database/tenant.service';
import { GroupDto, GroupMemberDto } from '../dto/base.dto';

@Injectable()
export class GroupService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly groupMemberRepo: Repository<GroupMember>,
    private readonly tenantService: TenantService
  ) { }

  async findAll() {
    const groups = await this.groupRepo.find({
      where: { tenantId: this.tenantService.getTenantId() },
      relations: ['members', 'user']
    });
    return { data: groups, status: HttpStatus.OK };
  }

  async findOne(id: string) {
    const group = await this.groupRepo.findOne({
      where: {
        id: Number(id),
        tenantId: this.tenantService.getTenantId()
      },
      relations: ['members', 'user']
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return { data: group, status: HttpStatus.OK };
  }

  async getGroupMembers(id: string) {
    const members = await this.groupMemberRepo.find({
      where: {
        groupId: Number(id),
        tenantId: this.tenantService.getTenantId()
      },
      relations: ['user']
    });

    return { data: members, status: HttpStatus.OK };
  }

  async createGroup(groupDto: GroupDto, id: number) {
    try {
      const newGroup = this.groupRepo.create({
        ...groupDto,
        createdBy: id ?? 1,
        tenantId: this.tenantService.getTenantId()
      });

      const group = await this.groupRepo.save(newGroup);

      await this.groupMemberRepo.save({
        status: true,
        tenantId: this.tenantService.getTenantId()
      });

      return { data: group, status: HttpStatus.CREATED };
    } catch (err) {
      throw new HttpException(err.message || err, HttpStatus.BAD_REQUEST);
    }
  }

  async joinGroup(joinGroupDto: GroupMemberDto) {
    const { userId, groupId } = joinGroupDto;
    try {
      const group = await this.groupRepo.findOne({
        where: {
          id: groupId,
          tenantId: this.tenantService.getTenantId()
        }
      });

      if (!group) {
        return { status: 2, data: null };
      }

      const existingMember = await this.groupMemberRepo.findOne({
        where: {
          userId: userId,
          group: { id: groupId },
          tenantId: this.tenantService.getTenantId()
        },
      });

      if (existingMember) {
        return { status: 3, data: null };
      }

      const memberData = {
        userId: userId,
        group: { id: groupId },
        role: 'member',
        status: true,
        tenantId: this.tenantService.getTenantId()
      } as GroupMember;

      const joinGroup = await this.groupMemberRepo.save(memberData);
      return joinGroup ? { status: 1, data: joinGroup } : { status: 0, data: null };
    } catch (err) {
      throw new HttpException(err.message || err, HttpStatus.BAD_REQUEST);
    }
  }
}
