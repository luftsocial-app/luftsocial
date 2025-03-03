import { Module } from '@nestjs/common';
import { FacebookModule } from './facebook/facebook.module';
import { PlatformsService } from './platforms.service';

@Module({
  imports: [FacebookModule],
  providers: [PlatformsService],
  exports: [PlatformsService],
})
export class PlatformsModule {}
