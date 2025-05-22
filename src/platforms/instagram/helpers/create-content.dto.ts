import {
  IsString,
  IsArray,
  IsUrl,
  IsOptional,
  ValidateNested,
  MaxLength,
  IsEnum,
  IsNumber,
  Min,
  Max,
  ArrayMaxSize,
  IsNotEmpty,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import { BasePlatformParams } from '../../../cross-platform/helpers/dtos/base-platform-params.dto';

/**
 * Sticker configuration for Instagram Stories
 */
export class StickerDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  text?: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  x: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  y: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  width: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  height: number;
}

export class CreateInstagramPostDto extends BasePlatformParams {
  @IsEnum(SocialPlatform, {
    message: 'Platform must be INSTAGRAM or INSTAGRAM_BUSINESS',
  })
  platform: SocialPlatform.INSTAGRAM | SocialPlatform.INSTAGRAM_BUSINESS;

  @IsOptional()
  @IsString()
  @MaxLength(2200, {
    message: 'Caption cannot exceed 2200 characters',
  })
  @Transform(({ value }) => value?.trim())
  caption?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30, { message: 'Maximum 30 hashtags allowed' })
  @IsString({ each: true })
  @MaxLength(100, {
    each: true,
    message: 'Each hashtag cannot exceed 100 characters',
  })
  @Transform(({ value }) => {
    if (!Array.isArray(value)) return value;
    // Remove # prefix if present, it will be added in the service
    return value.map((tag: string) => tag.trim().replace(/^#+/, ''));
  })
  hashtags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Maximum 20 mentions allowed' })
  @IsString({ each: true })
  @MaxLength(30, {
    each: true,
    message: 'Each mention cannot exceed 30 characters',
  })
  @Transform(({ value }) => {
    if (!Array.isArray(value)) return value;
    return value.map((mention: string) => mention.trim().replace(/^@+/, ''));
  })
  mentions?: string[];

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  mediaUrls: string[];
}

export class CreateStoryDto {
  @IsUrl({}, { message: 'Invalid media URL format' })
  mediaUrl: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: 'Maximum 10 stickers allowed per story' })
  @ValidateNested({ each: true })
  @Type(() => StickerDto)
  stickers?: StickerDto[];
}
