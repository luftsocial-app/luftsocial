export enum ResponseStatus {
  SUCCESS = 1,
  GROUP_NOT_FOUND = 2,
  NOT_ADMIN = 3,
  ALREADY_MEMBER = 4,
  USER_NOT_FOUND = 5,
}

export enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
  LINK = 'link',
  LOCATION = 'location',
}

export enum AttachmentType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
}

export enum StatusEnum {
  sent = 'sent',
  delivered = 'delivered',
  read = 'read',
}
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

  @IsEnum(MessageType)
  type: MessageType;

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
  conversation_id?: string;
}

export interface Attachment {
  url: string;

  type: MessageType;
}
