import {
  IsString,
  IsArray,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
  ValidateNested,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaItem } from '../../platform-service.interface';

export enum PrivacyLevel {
  PUBLIC = 'PUBLIC',
  FRIENDS = 'FRIENDS',
  ONLY_ME = 'ONLY_ME',
}

export class CreatePostDto {
  @IsString()
  @MaxLength(63206)
  content: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaItem)
  media?: MediaItem[];

  @IsOptional()
  @IsEnum(PrivacyLevel)
  privacyLevel?: PrivacyLevel;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targeting?: string[];
}

export class SchedulePostDto extends CreatePostDto {
  @IsDateString()
  scheduledTime: string;

  @IsOptional()
  @IsBoolean()
  draft?: boolean;
}

export class SchedulePagePostDto {
  @IsString()
  pageId: string;

  @IsString()
  @MaxLength(63206)
  content: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaItem)
  media?: MediaItem[];

  @IsDateString()
  scheduledTime: string;

  @IsOptional()
  @IsEnum(PrivacyLevel)
  privacyLevel?: PrivacyLevel;

  @IsOptional()
  @IsBoolean()
  draft?: boolean;
}

export class UpdatePostDto {
  @IsString()
  @MaxLength(63206)
  @IsOptional()
  content?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaItem)
  media?: MediaItem[];
}

export class PageInfo {
  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsObject()
  location?: {
    city?: string;
    country?: string;
    street?: string;
    zip?: string;
  };
}

export class UpdatePageDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  about?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PageInfo)
  pageInfo?: PageInfo;
}
