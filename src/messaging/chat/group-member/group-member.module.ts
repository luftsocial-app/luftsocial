import { Module } from '@nestjs/common';
import { GroupMemberController } from './group-member.controller';
import { GroupMemberService } from './group-member.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from 'src/entities/group.entity';
import { GroupMember } from 'src/entities/groupMembers.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Group, GroupMember])],
    providers: [GroupMemberService],
    controllers: [GroupMemberController],
})
export class GroupMemberModule { }