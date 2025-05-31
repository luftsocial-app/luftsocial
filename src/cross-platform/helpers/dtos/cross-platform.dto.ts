import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DateRange, ScheduleStatus } from '../cross-platform.interface';
import { IsNotPastDate } from '../../../utils/IsNotPastDate';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import { PlatformPostDto } from './platform-post.dto';

export class CreateCrossPlatformPostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(63206)
  content: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  mediaUrls?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlatformPostDto)
  @IsNotEmpty({ message: 'At least one platform must be specified' })
  platforms: PlatformPostDto[];
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
