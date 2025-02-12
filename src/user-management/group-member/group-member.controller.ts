import {
  Controller,
  Post,
  Body,
  Req,
  Delete,
  Param,
  Patch,
  Get,
} from '@nestjs/common';
import { GroupMemberService } from './group-member.service';
import { Request } from 'express';
import { AddMemberDto, UpdateMemberRoleDto } from './dto/group-member.dto';
import { CurrentUser } from '../../decorators/current-user.decorator';

@Controller('group-member')
export class GroupMemberController {
  constructor(private readonly groupMemberService: GroupMemberService) {}

  @Post(':groupId')
  addMember(
    @CurrentUser() user: any,
    @Param('groupId') groupId: string,
    @Body() addMemberDto: AddMemberDto,
    @Req() req: Request,
  ) {
    return this.groupMemberService.addMember(user.id, req.auth.orgId, {
      ...addMemberDto,
      groupId,
    });
  }

  @Delete(':groupId/:userId')
  removeMember(
    @CurrentUser() user: any,
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    return this.groupMemberService.removeMember(
      user.id,
      req.auth.orgId,
      groupId,
      userId,
    );
  }

  @Patch(':groupId/role')
  updateRole(
    @CurrentUser() user: any,
    @Param('groupId') groupId: string,
    @Body() updateRoleDto: UpdateMemberRoleDto,
    @Req() req: Request,
  ) {
    return this.groupMemberService.updateMemberRole(
      user.id,
      req.auth.orgId,
      groupId,
      updateRoleDto,
    );
  }

  @Get(':groupId')
  getMembers(@Param('groupId') groupId: string, @Req() req: Request) {
    return this.groupMemberService.getGroupMembers(groupId, req.auth.orgId);
  }
}
