import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { SocialPlatform } from '../../../../common/enums/social-platform.enum';

export class PublishPostDto {
  @IsArray()
  @IsEnum(SocialPlatform, { each: true })
  platforms: SocialPlatform[];

  @IsOptional()
  scheduledFor?: Date;
}
