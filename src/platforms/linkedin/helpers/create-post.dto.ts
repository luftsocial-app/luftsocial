import {
  IsString,
  IsOptional,
  IsArray,
  IsUrl,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import { BasePlatformParams } from '../../../cross-platform/helpers/dtos/base-platform-params.dto';

export class CreateLinkedInPostDto extends BasePlatformParams {
  @IsEnum(SocialPlatform)
  platform: SocialPlatform.LINKEDIN;

  @IsString()
  @MaxLength(3000)
  content: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  mediaUrls?: string[];

  @IsOptional()
  @IsString()
  visibility?: 'PUBLIC' | 'CONNECTIONS';
}
