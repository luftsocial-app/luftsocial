import {
  IsEnum,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  IsBoolean,
  IsString,
  IsArray,
  IsObject,
} from 'class-validator';
import { IConversationSettings } from '../../common/interface/message.interface';
import { Type } from 'class-transformer';
import { ChatParticipants } from '../../entities/chats/chat-participants.entity';

export class CreateConversationDto {
  @IsString()
  name: string;

  @IsEnum(['direct', 'group', 'channel'])
  type: 'direct' | 'group' | 'channel';

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean; // Default is false

  @IsString()
  senderId: string; // User ID of the sender

  @IsArray()
  participantIds: ChatParticipants[]; // Array of user IDs

  @IsObject()
  @IsOptional()
  metadata?: {
    name?: string;
    avatar?: string;
    isEncrypted?: boolean;
  };

  @IsObject()
  @IsOptional()
  settings?: IConversationSettings;
}

export class MessageQueryDto {
  @IsUUID()
  @IsString()
  conversationId: string; // The ID of the conversation to fetch messages from

  @IsOptional()
  @IsUUID()
  @IsString()
  senderId?: string; // Filter by sender ID (optional)

  @IsOptional()
  @IsString()
  searchTerm?: string; // Search messages by content (optional)

  @IsOptional()
  @IsBoolean()
  includeDeleted?: boolean; // Option to include soft-deleted messages

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1; // Page number for pagination, default to 1

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20; // Number of messages per page, default to 20

  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'senderId'; // Sorting criteria

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC'; // Sorting order
}
