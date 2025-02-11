import {
  IsString,
  IsUrl,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';

export enum PrivacyLevel {
  PUBLIC = 'PUBLIC',
  FRIENDS = 'FRIENDS',
  PRIVATE = 'PRIVATE',
}

export class CreateVideoDto {
  @IsString()
  @MaxLength(2200)
  description: string;

  @IsUrl()
  videoUrl: string;

  @IsOptional()
  @IsEnum(PrivacyLevel)
  privacyLevel?: PrivacyLevel;

  @IsOptional()
  @IsBoolean()
  disableDuet?: boolean;

  @IsOptional()
  @IsBoolean()
  disableStitch?: boolean;

  @IsOptional()
  @IsBoolean()
  disableComments?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  coverTimestamp?: number;

  @IsOptional()
  @IsDateString()
  scheduleTime?: string;
}

export class CreateDraftDto {
  @IsString()
  @MaxLength(2200)
  description: string;

  @IsUrl()
  videoUrl: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  coverTimestamp?: number;
}
