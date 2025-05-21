// Map platform enum values to their respective DTOs
import { IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import { BasePlatformParams } from './base-platform-params.dto';
import { CreateFacebookPagePostDto } from '../../../platforms/facebook/helpers/post.dto';
import { CreateTiktokVideoDto } from '../../../platforms/tiktok/helpers/create-video.dto';
import { CreateLinkedInPostDto } from '../../../platforms/linkedin/helpers/create-post.dto';
import { CreateInstagramPostDto } from '../../../platforms/instagram/helpers/create-content.dto';
export class PlatformPostDto {
  @IsEnum(SocialPlatform)
  platform: SocialPlatform;

  @IsOptional()
  @ValidateNested()
  @Type(() => BasePlatformParams, {
    discriminator: {
      property: 'platform',
      subTypes: [
        { value: CreateFacebookPagePostDto, name: SocialPlatform.FACEBOOK },
        { value: CreateTiktokVideoDto, name: SocialPlatform.TIKTOK },
        { value: CreateInstagramPostDto, name: SocialPlatform.INSTAGRAM },
        { value: CreateLinkedInPostDto, name: SocialPlatform.LINKEDIN },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  platformSpecificParams?: BasePlatformParams;
}
