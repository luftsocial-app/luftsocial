import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from '../entities/group.entity';
import { GroupDto, GroupMemberDto } from '../dto/base.dto';
import { GroupMember } from 'src/entities/groupMembers.entity';
import { Users } from 'src/entities/user.entity';

@Injectable()
export class GroupService {
    constructor(
        @InjectRepository(Group)
        private readonly groupRepository: Repository<Group>,
        @InjectRepository(GroupMember)
        private readonly groupMemberRepository: Repository<GroupMember>,
    ) { }

    async createGroup(groupDto: GroupDto, id: number): Promise<{ data: Group | null; status: number }> {
        try {
            groupDto.createdBy = id ?? 1;
            const newGroup = this.groupRepository.create(groupDto);
            const data = await this.groupRepository.save(newGroup);
            const payload = {
                userId: data?.createdBy,
                role: 'admin' as 'admin' | 'member',
                groupId: data?.id,
            }
            const addGroupMember = this.groupMemberRepository.create(payload);
            await this.groupMemberRepository.save(addGroupMember);
            if (data) {
                return {
                    data,
                    status: 1
                };
            }
            return {
                status: 0,
                data: null,
            };
        } catch (err) {
            throw new HttpException(err.message || err, HttpStatus.BAD_REQUEST);
        }
    }

    async joinGroup(joinGroupDto: GroupMemberDto): Promise<{ data: GroupMember | null; status: number }> {
        const { userId, groupId } = joinGroupDto;
        try {
            const group = await this.groupRepository.findOne({ where: { id: groupId } });
            if (!group) {
                return {
                    status: 2,
                    data: null
                }
            }
            const existingMember = await this.groupMemberRepository.findOne({
                where: {
                    user: { id: userId },
                    group: { id: groupId },
                },
            });
            if (existingMember) {
                return {
                    status: 3,
                    data: null
                }
            }
            const joinGroup = await this.groupMemberRepository.save(joinGroupDto);
            if (joinGroup) {
                return {
                    status: 1,
                    data: joinGroup
                }
            } else if (!joinGroup) {
                return {
                    status: 0,
                    data: null
                }
            }
        } catch (err) {
            throw new HttpException(err.message || err, HttpStatus.BAD_REQUEST);
        }
    }
}