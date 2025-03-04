import { Module } from '@nestjs/common';
import { FacebookPageMetricsJob } from './jobs/page_metrics-collection.job';
import { FacebookController } from './facebook.controller';
import { FacebookRepository } from './repositories/facebook.repository';
import { FacebookPageInsightsJob } from './jobs/page-insight.job';
import { FacebookService } from './facebook.service';
import { FacebookPostMetricsJob } from './jobs/post-metrics-collection.job';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacebookAccount } from './entity/facebook-account.entity';
import { FacebookPage } from './entity/facebook-page.entity';
import { FacebookPost } from './entity/facebook-post.entity';
import { FacebookPostMetric } from './entity/facebook-post-metric.entity';
import { FacebookPageMetric } from './entity/facebook-page-metric.entity';
import { AuthState } from './entity/auth-state.entity';
import { SocialAccount } from '../entity/social-account.entity';
import { MediaStorageModule } from '../../asset-management/media-storage/media-storage.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  controllers: [FacebookController],
  providers: [
    FacebookService,
    FacebookRepository,
    FacebookPageMetricsJob,
    FacebookPostMetricsJob,
    FacebookPageInsightsJob,
  ],
  imports: [
    TypeOrmModule.forFeature([
      FacebookAccount,
      FacebookPage,
      FacebookPost,
      FacebookPostMetric,
      FacebookPageMetric,
      AuthState,
      SocialAccount,
    ]),
    DatabaseModule,
    MediaStorageModule,
  ],
  exports: [FacebookService],
})
export class FacebookModule {}
