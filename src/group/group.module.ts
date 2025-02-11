import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupService } from './group.service';
import { GroupController } from './group.controller';
import { Group } from '../entities/group.entity';
import { GroupMember } from '../entities/groupMembers.entity';
import { TenantService } from '../database/tenant.service';

@Module({
  imports: [TypeOrmModule.forFeature([Group, GroupMember])],
  providers: [GroupService, TenantService],
  controllers: [GroupController],
  exports: [GroupService],
})
export class GroupModule {}
