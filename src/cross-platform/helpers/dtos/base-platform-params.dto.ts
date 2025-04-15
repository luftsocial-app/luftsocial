import { IsEnum } from 'class-validator';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
export class BasePlatformParams {
  @IsEnum(SocialPlatform)
  platform: SocialPlatform;
}
