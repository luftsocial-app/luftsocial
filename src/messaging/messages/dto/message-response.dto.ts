import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageStatus } from '../../shared/enums/message-type.enum';

export class MessageReactionDto {
  @ApiProperty({
    description: 'User ID who added the reaction',
    example: 'a1b2c3d4-e5f6-g7h8-i9j0',
  })
  userId: string;

  @ApiProperty({ description: 'Emoji reaction', example: '👍' })
  emoji: string;

  @ApiProperty({
    description: 'When the reaction was added',
    example: '2023-01-01T12:00:00.000Z',
  })
  createdAt: Date;
}

export class AttachmentResponseDto {
  @ApiProperty({
    description: 'Attachment ID',
    example: 'a1b2c3d4-e5f6-g7h8-i9j0',
  })
  id: string;

  @ApiProperty({ description: 'File name', example: 'document.pdf' })
  fileName: string;

  @ApiProperty({ description: 'File size in bytes', example: 1024 })
  fileSize: number;

  @ApiProperty({ description: 'MIME type', example: 'application/pdf' })
  mimeType: string;

  @ApiProperty({
    description: 'File URL',
    example: 'https://storage.example.com/files/document.pdf',
  })
  url: string;

  @ApiPropertyOptional({
    description: 'Processing status',
    example: 'COMPLETED',
  })
  processingStatus?: string;

  @ApiProperty({
    description: 'When the attachment was created',
    example: '2023-01-01T12:00:00.000Z',
  })
  createdAt: Date;
}

export class MessageResponseDto {
  @ApiProperty({
    description: 'Message ID',
    example: 'a1b2c3d4-e5f6-g7h8-i9j0',
  })
  id: string;

  @ApiProperty({
    description: 'Conversation ID',
    example: 'b2c3d4e5-f6g7-h8i9-j0k1',
  })
  conversationId: string;

  @ApiProperty({ description: 'Message content', example: 'Hello world!' })
  content: string;

  @ApiProperty({ description: 'Sender ID', example: 'c3d4e5f6-g7h8-i9j0-k1l2' })
  senderId: string;

  @ApiPropertyOptional({ description: 'Sender username', example: 'johndoe' })
  senderUsername?: string;

  @ApiPropertyOptional({
    description: 'Parent message ID (for threaded replies)',
    example: 'd4e5f6g7-h8i9-j0k1-l2m3',
  })
  parentMessageId?: string;

  @ApiProperty({
    description: 'Message status',
    enum: MessageStatus,
    example: MessageStatus.SENT,
  })
  status: MessageStatus;

  @ApiPropertyOptional({
    description: 'Reactions to this message',
    type: [MessageReactionDto],
  })
  reactions?: MessageReactionDto[];

  @ApiPropertyOptional({
    description: 'Edits history',
    example: ['Original content', 'First edit'],
  })
  editHistory?: string[];

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2023-01-01T12:00:00.000Z',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Update timestamp',
    example: '2023-01-01T12:30:00.000Z',
  })
  updatedAt?: Date;

  @ApiPropertyOptional({
    description: 'Users who have read this message',
    type: 'object',
    additionalProperties: { type: 'string', format: 'date-time' },
    example: {
      'user1-id': '2023-01-01T12:00:00.000Z',
      'user2-id': '2023-01-01T12:05:00.000Z',
    },
  })
  readBy?: { [userId: string]: Date };

  @ApiPropertyOptional({
    description: 'Whether the current user has read this message',
    example: true,
  })
  isRead?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the message has been edited',
    example: true,
  })
  isEdited?: boolean;

  @ApiPropertyOptional({
    description: 'Additional metadata about the message',
    example: {
      editHistory: ['Original message'],
    },
  })
  metadata?: {
    editHistory?: object[];
    [key: string]: any;
  };
}

export class MessageWithRelationsDto extends MessageResponseDto {
  @ApiPropertyOptional({
    description: 'Attachments for this message',
    type: [AttachmentResponseDto],
  })
  attachments?: AttachmentResponseDto[];

  @ApiPropertyOptional({
    description: 'Number of thread replies',
    example: 5,
  })
  replyCount?: number;
}

export class MessageListResponseDto {
  @ApiProperty({
    description: 'List of messages',
    type: [MessageResponseDto],
  })
  messages: MessageResponseDto[];

  @ApiProperty({ description: 'Total message count', example: 100 })
  total: number;

  @ApiProperty({ description: 'Current page', example: 1 })
  page: number;

  @ApiProperty({ description: 'Page size', example: 20 })
  pageSize: number;

  @ApiPropertyOptional({ description: 'Unread count for the user', example: 5 })
  unreadCount?: number;
}

export class UnreadCountResponseDto {
  @ApiProperty({ description: 'Number of unread messages', example: 5 })
  count: number;

  @ApiProperty({
    description: 'Conversation ID',
    example: 'a1b2c3d4-e5f6-g7h8-i9j0',
  })
  conversationId: string;
}
