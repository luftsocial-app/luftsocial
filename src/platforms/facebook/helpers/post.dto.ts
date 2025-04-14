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
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import { BasePlatformParams } from '../../../cross-platform/helpers/dtos/base-platform-params.dto';

export enum PrivacyLevel {
  PUBLIC = 'PUBLIC',
  FRIENDS = 'FRIENDS',
  ONLY_ME = 'ONLY_ME',
}

export class CreateFacebookPagePostDto extends BasePlatformParams {
  @IsEnum(SocialPlatform)
  platform: SocialPlatform.FACEBOOK;

  @IsString()
  @MaxLength(63206)
  content: string;

  @IsString()
  pageId: string;

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

  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsDateString()
  scheduledPublishTime?: Date;
}

export class SchedulePostDto extends CreateFacebookPagePostDto {
  @IsDateString()
  scheduledTime: string;

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
