import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMessageDto {
  @ApiProperty({
    description: 'The updated content of the message',
    example: 'Hello world!',
    required: true,
  })
  @IsString()
  content: string;
}
