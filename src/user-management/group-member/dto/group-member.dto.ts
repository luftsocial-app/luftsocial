import { IsUUID, IsEnum, IsOptional } from 'class-validator';
import { GroupRole } from '../../../common/enums/roles';

export class AddMemberDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  groupId: string;

  @IsEnum(GroupRole)
  @IsOptional()
  role?: GroupRole = GroupRole.MEMBER;
}

export class UpdateMemberRoleDto {
  @IsUUID()
  userId: string;

  @IsEnum(GroupRole)
  newRole: GroupRole;
}
