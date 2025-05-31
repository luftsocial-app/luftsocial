import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  Length,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AttachmentDto {
  @IsString()
  fileName: string;

  @IsString()
  mimeType: string;

  @IsString()
  fileKey: string;

  @IsString()
  mediaType: string;

  @IsOptional()
  @IsString()
  thumbnailKey?: string;
}

export class CreateMessageDto {
  @ApiProperty({
    description: 'The ID of the conversation where the message is being sent',
    example: 'a1b2c3d4-e5f6-g7h8-i9j0',
  })
  @IsUUID()
  @IsNotEmpty()
  conversationId: string;

  @ApiProperty({
    description: 'The content of the message',
    example: 'Hello world!',
    minLength: 1,
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @Length(0, 5000)
  content?: string;

  @ApiPropertyOptional({
    description: 'Optional parent message ID for threaded replies',
    example: 'b2c3d4e5-f6g7-h8i9-j0k1',
  })
  @IsUUID()
  @IsOptional()
  parentMessageId?: string;

  @IsString()
  @IsOptional()
  uploadSessionId?: string;
}

export class UpdateMessageDto {
  @ApiProperty({
    description: 'The updated content of the message',
    example: 'Updated message content',
    minLength: 1,
    maxLength: 5000,
  })
  @IsString()
  @IsOptional()
  @Length(0, 5000)
  content?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}

export class ReactionDto {
  @ApiProperty({
    description: 'The emoji reaction to add',
    example: '👍',
  })
  @IsString()
  @IsNotEmpty()
  emoji: string;
}

export class PrepareAttachmentDto {
  @ApiProperty({ description: 'File name', example: 'example.pdf' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({
    description:
      'MIME type of the file (optional, will be detected from file extension if not provided)',
    example: 'application/pdf',
    required: false,
  })
  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsString()
  @IsOptional()
  uploadSessionId?: string;

  @ApiProperty({ description: 'Conversation ID', example: 'conv_123' })
  @IsUUID()
  conversationId: string;
}
