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
  @IsString()
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
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @IsOptional()
  members?: any[]; // Adjust type as needed if GroupMemberDto is included

  @IsOptional()
  messages?: any[]; // Adjust type as needed if MessageDto is included
}

export class GroupMemberDto extends IBase {
  @IsOptional()
  @IsString()
  groupId?: string;

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
}

export class MessageDto extends IBase {
  @IsOptional()
  @IsString()
  senderId?: string;

  @IsOptional()
  receiverId?: string;

  @IsOptional()
  groupId?: string;

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

  @IsOptional()
  conversation_id?:string
}
