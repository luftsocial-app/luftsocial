import { Module } from '@nestjs/common';
import { InstagramMetricsCollectionJob } from './jobs/metrics-collection.job';
import { InstagramTokenRefreshJob } from './jobs/token-refresh.job';
import { InstagramController } from './Instagram.controller';
import { InstagramRepository } from './repositories/Instagram.repository';
import { InstagramService } from './Instagram.service';

@Module({
  controllers: [InstagramController],
  providers: [
    InstagramService,
    InstagramRepository,
    InstagramMetricsCollectionJob,
    InstagramTokenRefreshJob,
  ],
  exports: [InstagramService],
})
export class InstagramModule {}
