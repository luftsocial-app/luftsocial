import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsOptional,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SocialPlatform } from '../../../../common/enums/social-platform.enum';

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
  content: string;

  @IsOptional()
  @IsArray()
  mediaUrls?: string[];

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlatformDto)
  platforms: PlatformDto[];

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}
