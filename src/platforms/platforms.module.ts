// src/platforms/platforms.module.ts
import { Module } from '@nestjs/common';
import { InstagramModule } from './instagram/instagram.module';
import { CrossPlatformModule } from '../cross-platform/cross-platform.module';
import { FacebookModule } from './facebook/facebook.module';
import { LinkedInModule } from './linkedin/linked.module';
import { TikTokModule } from './tiktok/titkot.module';
import { PlatformsService } from './platforms.service';

@Module({
  imports: [
    FacebookModule,
    InstagramModule,
    LinkedInModule,
    TikTokModule,
    CrossPlatformModule,
  ],
  providers: [PlatformsService],
  exports: [PlatformsService],
})
export class PlatformsModule {}
