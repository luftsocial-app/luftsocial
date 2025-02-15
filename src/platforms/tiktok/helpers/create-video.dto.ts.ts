import {
  IsString,
  IsUrl,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  MaxLength,
} from 'class-validator';
import {
  TikTokPostVideoStatus,
  TikTokVideoPrivacyLevel,
} from './tiktok.interfaces';

export class CreateVideoDto {
  @IsString()
  @MaxLength(2200)
  title?: string;

  @IsEnum(TikTokVideoPrivacyLevel)
  privacyLevel: TikTokVideoPrivacyLevel =
    TikTokVideoPrivacyLevel.PUBLIC_TO_EVERYONE;

  @IsEnum(TikTokPostVideoStatus)
  status: TikTokPostVideoStatus = TikTokPostVideoStatus.PENDING;

  @IsOptional()
  @IsBoolean()
  disableDuet?: boolean;

  @IsOptional()
  @IsBoolean()
  disableStitch?: boolean;

  @IsOptional()
  @IsBoolean()
  disableComment?: boolean;

  @IsOptional()
  @IsNumber()
  videoCoverTimestampMs?: number;

  @IsOptional()
  @IsBoolean()
  brandContentToggle?: boolean;

  @IsOptional()
  @IsBoolean()
  brandOrganicToggle?: boolean;

  @IsOptional()
  @IsBoolean()
  isAigc?: boolean;

  @IsOptional()
  @IsUrl()
  videoUrl?: string;
}
