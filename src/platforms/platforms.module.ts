import { Module } from '@nestjs/common';
import { FacebookModule } from './facebook/facebook.module';
import { PlatformsService } from './platforms.service';
import { InstagramModule } from './instagram/instagram.module';

@Module({
  imports: [FacebookModule, InstagramModule],
  providers: [PlatformsService],
  exports: [PlatformsService],
})
export class PlatformsModule {}
