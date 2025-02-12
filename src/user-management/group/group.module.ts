import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupService } from './group.service';
import { GroupController } from './group.controller';
import { Group } from '../../entities/group.entity';
import { TenantService } from '../../database/tenant.service';
import { GroupMember } from '../../entities/group.members.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Group, GroupMember])],
  providers: [GroupService, TenantService],
  controllers: [GroupController],
  exports: [GroupService],
})
export class GroupModule {}
