import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupMemberController } from './group-member.controller';
import { GroupMemberService } from './group-member.service';
import { Group } from '../entities/group.entity';
import { GroupMember } from '../entities/groupMembers.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GroupMember, Group, User])],
  controllers: [GroupMemberController],
  providers: [GroupMemberService],
  exports: [GroupMemberService],
})
export class GroupMemberModule {}
