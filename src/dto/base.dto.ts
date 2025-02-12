import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsDate,
  IsUrl,
} from 'class-validator';

// Enum for status in MessageDto
export enum StatusEnum {
  sent = 'sent',
  delivered = 'delivered',
  read = 'read',
}

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
  id?: number;

  @IsOptional()
  @IsDate()
  createdAt?: Date;

  @IsOptional()
  @IsDate()
  updatedAt?: Date;
}

export class GroupDto extends IBase {
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  createdBy?: number;

  @IsOptional()
  @IsBoolean()
  status?: boolean;
}

export class GroupMemberDto extends IBase {
  @IsOptional()
  @IsNumber()
  groupId?: number;

  @IsOptional()
  @IsNumber()
  userId?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @IsOptional()
  @IsBoolean()
  joinedAt?: Date;
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
