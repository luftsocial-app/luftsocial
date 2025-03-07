import {
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  IsBoolean,
  IsString,
  IsEnum,
  IsArray,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationType } from '../../shared/enums/conversation-type.enum';
import { IConversationSettings } from '../../shared/interfaces/conversation-settings.interface';

export class CreateConversationDto {
  @ApiPropertyOptional({
    description:
      'The name of the conversation (required for group conversations)',
    example: 'Project Team Chat',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'The type of conversation',
    enum: ConversationType,
    example: ConversationType.GROUP,
  })
  @IsEnum(ConversationType)
  type: ConversationType;

  @ApiProperty({
    description: 'IDs of users to add to the conversation',
    type: [String],
    example: ['a1b2c3d4-e5f6-g7h8-i9j0', 'b2c3d4e5-f6g7-h8i9-j0k1'],
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  participantIds: string[];

  @ApiPropertyOptional({
    description: 'ID of the user creating the conversation',
    type: String,
    example: 'a1b2c3d4-e5f6-g7h8-i9j0',
  })
  @IsUUID()
  @IsOptional()
  creatorId?: string;

  @ApiPropertyOptional({
    description: 'Whether the conversation is private',
    default: false,
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @ApiPropertyOptional({
    description: 'Additional metadata for the conversation',
    example: {
      avatar: 'https://example.com/avatar.jpg',
      isEncrypted: false,
    },
  })
  @IsOptional()
  metadata?: {
    avatar?: string;
    isEncrypted?: boolean;
  };

  @ApiPropertyOptional({
    description: 'Conversation settings',
    example: {
      muteNotifications: false,
      theme: 'light',
      enableReadReceipts: true,
    },
  })
  @IsOptional()
  settings?: IConversationSettings;
}

export class UpdateConversationSettingsDto {
  @ApiPropertyOptional({
    description: 'New name for the conversation',
    example: 'Updated Team Chat',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Update privacy setting for the conversation',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @ApiPropertyOptional({
    description: 'Updated metadata for the conversation',
    example: {
      avatar: 'https://example.com/new-avatar.jpg',
      isEncrypted: true,
    },
  })
  @IsOptional()
  metadata?: {
    avatar?: string;
    isEncrypted?: boolean;
  };

  @ApiPropertyOptional({
    description: 'Updated conversation settings',
    example: {
      muteNotifications: true,
      theme: 'dark',
      enableReadReceipts: false,
    },
  })
  @IsOptional()
  settings?: Partial<IConversationSettings>;
}

export class AddParticipantsDto {
  @ApiProperty({
    description: 'IDs of users to add to the conversation',
    type: [String],
    example: ['a1b2c3d4-e5f6-g7h8-i9j0', 'b2c3d4e5-f6g7-h8i9-j0k1'],
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsNotEmpty()
  participantIds: string[];
}

export class MessageQueryDto {
  @ApiProperty({
    description: 'ID of the conversation to fetch messages from',
    type: String,
    example: 'a1b2c3d4-e5f6-g7h8-i9j0',
  })
  @IsUUID()
  @IsString()
  conversationId: string;

  @ApiPropertyOptional({
    description: 'User ID for personalized responses like read status',
    type: String,
    example: 'c3d4e5f6-g7h8-i9j0-k1l2',
  })
  @IsOptional()
  @IsUUID()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter messages by sender ID',
    type: String,
    example: 'b2c3d4e5-f6g7-h8i9-j0k1',
  })
  @IsOptional()
  @IsUUID()
  @IsString()
  senderId?: string;

  @ApiPropertyOptional({
    description: 'Search term to filter messages by content',
    example: 'project update',
  })
  @IsOptional()
  @IsString()
  searchTerm?: string;

  @ApiPropertyOptional({
    description: 'Whether to include deleted messages',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeDeleted?: boolean;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of messages per page',
    minimum: 1,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Field to sort messages by',
    enum: ['createdAt', 'senderId'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'senderId';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';
}
