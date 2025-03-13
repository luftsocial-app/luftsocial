import { Module } from '@nestjs/common';
import { FacebookModule } from './facebook/facebook.module';
import { PlatformsService } from './platforms.service';
import { InstagramModule } from './instagram/instagram.module';
import { LinkedInModule } from './linkedin/linkedin.module';
import { TikTokModule } from './tiktok/titkot.module';

@Module({
  imports: [FacebookModule, InstagramModule, LinkedInModule, TikTokModule],
  providers: [PlatformsService],
  exports: [PlatformsService],
})
export class PlatformsModule {}
