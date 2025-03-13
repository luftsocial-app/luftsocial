import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  @Length(1, 5000)
  content: string;

  @ApiPropertyOptional({
    description: 'Optional parent message ID for threaded replies',
    example: 'b2c3d4e5-f6g7-h8i9-j0k1',
  })
  @IsUUID()
  @IsOptional()
  parentMessageId?: string;
}

export class UpdateMessageDto {
  @ApiProperty({
    description: 'The updated content of the message',
    example: 'Updated message content',
    minLength: 1,
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 5000)
  content: string;
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
