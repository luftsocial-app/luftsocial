import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SocialPlatform } from 'src/enum/social-platform.enum';
import { DateRange, ScheduleStatus } from './cross-platform.interface';
import { IsNotPastDate } from 'src/utils/IsNotPastDate';

export class CreateCrossPlatformPostDto {
  @IsString()
  @MinLength(1)
  content: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  mediaUrls?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlatformPostDto)
  platforms: PlatformPostDto[];
}

export class PlatformPostDto {
  @IsEnum(SocialPlatform)
  platform: SocialPlatform;

  @IsString()
  accountId: string;

  @IsOptional()
  @IsObject()
  platformSpecificParams?: any;
}

export class ScheduleCrossPlatformPostDto extends CreateCrossPlatformPostDto {
  @IsDateString()
  @IsNotPastDate({ message: 'Date cannot be in the past' })
  scheduledTime: string;
}

export class ScheduleFiltersDto {
  @IsOptional()
  @IsEnum(ScheduleStatus)
  status?: ScheduleStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(SocialPlatform)
  platform?: SocialPlatform;
}

export class UpdateScheduleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  mediaUrls?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlatformPostDto)
  platforms?: PlatformPostDto[];

  @IsOptional()
  @IsDateString()
  @IsNotPastDate({ message: 'Date cannot be in the past' })
  scheduledTime?: string;
}

export class AnalyticsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlatformAnalyticsDto)
  platforms: PlatformAnalyticsDto[];

  @IsNotEmpty()
  dateRange: DateRange;
}

export class PlatformAnalyticsDto {
  @IsEnum(SocialPlatform)
  platform: SocialPlatform;

  @IsString()
  accountId: string;
}

export class ContentPerformanceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentItemDto)
  postIds: ContentItemDto[];
}

export class ContentItemDto {
  @IsEnum(SocialPlatform)
  platform: SocialPlatform;

  @IsString()
  postId: string;
}
