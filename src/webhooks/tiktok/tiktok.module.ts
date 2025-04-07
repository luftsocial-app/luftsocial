import { Module } from '@nestjs/common';
import { TiktokController } from './tiktok.controller';
import { TiktokService } from './tiktok.service';

@Module({
  controllers: [TiktokController],
  providers: [TiktokService],
})
export class TiktokModule {}
