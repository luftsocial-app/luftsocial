import { IsString, IsUUID, IsEnum, IsOptional, IsDate } from 'class-validator';
import { UserRole, Permission } from '../enums/roles';

export class BaseEntityDto {
  @IsUUID()
  id: string;

  @IsUUID()
  TenantId: string;

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;

  @IsDate()
  @IsOptional()
  deletedAt?: Date;
}

export class UserDto extends BaseEntityDto {
  @IsString()
  clerkId: string;

  @IsString()
  email: string;

  @IsEnum(UserRole)
  UserRole: UserRole;

  @IsOptional()
  permissions?: Permission[];
}

export class UpdateUserRoleRequest {
  @IsUUID()
  userId: string;

  @IsEnum(UserRole)
  newRole: UserRole;

  @IsString()
  @IsOptional()
  reason?: string;
}
