import {
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  IsBoolean,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ConversationType } from '../../database/entities/chats/conversation.entity';

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

export interface CreateConversationDto {
  name?: string;
  type: ConversationType;
  participantIds: string[];
  isPrivate?: boolean;
  metadata?: {
    avatar?: string;
    isEncrypted?: boolean;
  };
  settings?: any;
}
