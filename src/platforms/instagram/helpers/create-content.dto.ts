import {
  IsString,
  IsArray,
  IsUrl,
  IsOptional,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

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

export class CreatePostDto {
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
