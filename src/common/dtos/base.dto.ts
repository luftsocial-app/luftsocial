import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsDate,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';
import { MessageStatus, MessageType } from '../enums/messaging';
import { GroupRole, Permission, UserRole } from '../enums/roles';

// Enum for status in MessageDto

export enum MessageTypeEnum {
  text = 'text',
  image = 'image',
  video = 'video',
  link = 'link',
  mixed = 'mixed',
}

class IBase {
  @IsNumber()
  @IsOptional()
  id?: string;

  @IsOptional()
  @IsDate()
  createdAt?: Date;

  @IsOptional()
  @IsDate()
  updatedAt?: Date;
}

export class GroupDto extends IBase {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  createdBy?: number;

  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @IsOptional()
  @IsString()
  tenantId: string;
}

export class GroupMemberDto extends IBase {
  @IsNotEmpty()
  @IsNumber()
  groupId: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @IsOptional()
  @IsBoolean()
  joinedAt?: Date;

  @IsOptional()
  role?: GroupRole;

  @IsOptional()
  @IsString()
  tenantId: string;
}

export class CreateMessageRequest {
  @IsEnum(MessageType)
  type: MessageType;

  @IsString()
  content: string;

  @IsUUID()
  conversationId: string;

  @IsOptional()
  metadata?: {
    reactions?: Record<string, unknown>;
  };
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

export class BaseEntityDto {
  @IsUUID()
  id: string;

  @IsUUID()
  tenantId: string;

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;

  @IsDate()
  @IsOptional()
  deletedAt?: Date;
}

export class UserDto extends BaseEntityDto {
  @IsUUID()
  id: string;
  @IsString()
  clerkId: string;

  @IsString()
  email: string;

  @IsEnum(UserRole)
  UserRole: UserRole;

  @IsOptional()
  permissions?: Permission[];

  @IsUUID()
  tenantId: string;

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;

  @IsDate()
  @IsOptional()
  deletedAt?: Date;
}

export class MessageDto extends BaseEntityDto {
  @IsEnum(MessageType)
  type: MessageType;

  @IsEnum(MessageStatus)
  status: MessageStatus;

  @IsString()
  content: string;

  @IsUUID()
  senderId: string;

  @IsUUID()
  conversationId: string;

  @IsOptional()
  metadata?: {
    reactions?: Record<string, unknown>;
  };
}
