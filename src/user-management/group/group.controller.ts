import {
  Controller,
  Post,
  Body,
  Request,
  Get,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GroupService } from './group.service';
import { GroupDto, GroupMemberDto } from '../../common/dtos/base.dto';

@Controller('groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  private getTenantId(req: any): string {
    const tenantId = req.auth?.orgId || req.auth?.userId;
    if (!tenantId) {
      throw new HttpException('Tenant ID is required', HttpStatus.BAD_REQUEST);
    }
    return String(tenantId); // Ensure tenantId is string
  }

  @Post()
  async createGroup(@Request() req, @Body() groupDto: GroupDto) {
    const userId = req.auth?.userId;
    const tenantId = this.getTenantId(req);
    groupDto.tenantId = tenantId;
    return this.groupService.createGroup(groupDto, userId);
  }

  @Post('join')
  async joinGroup(@Request() req, @Body() joinGroupDto: GroupMemberDto) {
    const tenantId = this.getTenantId(req);
    joinGroupDto.tenantId = tenantId;
    joinGroupDto.userId = req.auth?.userId;
    return this.groupService.joinGroup(joinGroupDto);
  }

  @Get()
  async getGroups() {
    return this.groupService.findAll();
  }

  @Get(':id')
  async getGroup(@Request() req, @Param('id') id: string) {
    return this.groupService.findOne(id);
  }

  @Get(':id/members')
  async getGroupMembers(@Request() req, @Param('id') id: string) {
    return this.groupService.getGroupMembers(id);
  }
}
