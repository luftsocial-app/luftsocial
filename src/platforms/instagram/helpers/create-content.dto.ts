import {
  IsString,
  IsArray,
  IsUrl,
  IsOptional,
  ValidateNested,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import { BasePlatformParams } from '../../../cross-platform/helpers/dtos/base-platform-params.dto';

export class StickerDto {
  @IsString()
  type: string;

  @IsString()
  text?: string;

  x: number;
  y: number;
  width: number;
  height: number;
}

export class CreateInstagramPostDto extends BasePlatformParams {
  @IsEnum(SocialPlatform)
  platform: SocialPlatform.INSTAGRAM;

  @IsString()
  @MaxLength(2200)
  caption: string;

  @IsArray()
  @IsUrl({}, { each: true })
  mediaUrls: string[];

  @IsOptional()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  hashtags?: string[];

  @IsOptional()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  mentions?: string[];
}

export class CreateStoryDto {
  @IsUrl()
  mediaUrl: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StickerDto)
  stickers?: StickerDto[];
}
