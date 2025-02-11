import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsDate,
  IsUrl,
  IsNotEmpty,
} from 'class-validator';
import { GroupRole } from '../types/enums';

// Enum for status in MessageDto
enum StatusEnum {
  sent = 'sent',
  delivered = 'delivered',
  read = 'read',
}

enum MessageTypeEnum {
  text = 'text',
  image = 'image',
  video = 'video',
  link = 'link',
  mixed = 'mixed',
}

class IBase {
  @IsNumber()
  @IsOptional()
  id?: number;

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
  groupId: number;

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

export class MessageDto extends IBase {
  @IsOptional()
  @IsNumber()
  senderId?: number;

  @IsOptional()
  receiverId?: number;

  @IsOptional()
  groupId?: number;

  @IsEnum(MessageTypeEnum)
  type: MessageTypeEnum;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsUrl()
  mediaUrl?: string;

  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @IsEnum(StatusEnum)
  status?: StatusEnum;

  @IsOptional()
  @IsDate()
  sentAt?: Date;

  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;
}
