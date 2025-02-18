import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({
    description: 'The title of the post',
    example: 'My First Post',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  title: string;

  @ApiProperty({
    description: 'The content of the post',
    example: 'This is the content of my first post',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  content: string;

  @ApiProperty({
    description: 'The Tenant ID',
    example: 'org_123456',
  })
  @IsString()
  @IsNotEmpty()
  tenantId: string;
}
