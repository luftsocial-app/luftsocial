// src/platforms/platforms.module.ts
import { Module } from '@nestjs/common';
import { InstagramModule } from './instagram/instagram.module';
import { CrossPlatformModule } from '../cross-platform/cross-platform.module';
import { FacebookModule } from './facebook/facebook.module';
import { TikTokModule } from './tiktok/titkot.module';
import { PlatformsService } from './platforms.service';
import { LinkedInModule } from './linkedin/linkedin.module';
import { PlatformAuthModule } from 'src/platform-auth/platform-auth.module';

@Module({
  imports: [
    FacebookModule,
    InstagramModule,
    LinkedInModule,
    TikTokModule,
    CrossPlatformModule,
    PlatformAuthModule,
  ],
  providers: [PlatformsService],
  exports: [PlatformsService],
})
export class PlatformsModule {}
