import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsOptional,
  ValidateNested,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SocialPlatform } from '../../../../common/enums/social-platform.enum';
import { PlatformPostDto } from '../../../../cross-platform/helpers/dtos/platform-post.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PlatformDto {
  @IsNotEmpty()
  @IsEnum(SocialPlatform)
  platform: SocialPlatform;

  @IsOptional()
  @IsString()
  platformAccountId?: string;
}

export class CreateDraftPostDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsArray()
  mediaUrls?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlatformPostDto)
  @IsNotEmpty({ message: 'At least one platform must be specified' })
  platforms: PlatformPostDto[];

  @ApiPropertyOptional({
    description: 'Task ID this post is created for (usually from query param)',
  })
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional({
    description: 'Notes about how this post addresses the task requirements',
  })
  @IsOptional()
  @IsString()
  taskNotes?: string;

  @ApiPropertyOptional({
    description: 'Tags related to the task or post requirements',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  taskTags?: string[];
}
