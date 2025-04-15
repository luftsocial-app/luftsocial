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
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import { BasePlatformParams } from '../../../cross-platform/helpers/dtos/base-platform-params.dto';

export class CreateTiktokVideoDto extends BasePlatformParams {
  @IsEnum(SocialPlatform)
  platform: SocialPlatform.TIKTOK;

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
