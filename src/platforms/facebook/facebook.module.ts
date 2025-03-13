import { Module } from '@nestjs/common';
import { FacebookPageMetricsJob } from './jobs/page_metrics-collection.job';
import { FacebookController } from './facebook.controller';
import { FacebookRepository } from './repositories/facebook.repository';
import { FacebookPageInsightsJob } from './jobs/page-insight.job';
import { FacebookService } from './facebook.service';
import { FacebookPostMetricsJob } from './jobs/post-metrics-collection.job';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaStorageModule } from '../../asset-management/media-storage/media-storage.module';
import { DatabaseModule } from '../../database/database.module';
import { PlatformAuthModule } from '../../platform-auth/platform-auth.module';
import { SocialAccount } from '../../entities/notifications/entity/social-account.entity';
import { AuthState } from '../../entities/socials/facebook-entities/auth-state.entity';
import { FacebookAccount } from '../../entities/socials/facebook-entities/facebook-account.entity';
import { FacebookPageMetric } from '../../entities/socials/facebook-entities/facebook-page-metric.entity';
import { FacebookPage } from '../../entities/socials/facebook-entities/facebook-page.entity';
import { FacebookPostMetric } from '../../entities/socials/facebook-entities/facebook-post-metric.entity';
import { FacebookPost } from '../../entities/socials/facebook-entities/facebook-post.entity';

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
      PlatformAuthModule,
    ]),
    DatabaseModule,
    MediaStorageModule,
  ],
  exports: [FacebookService],
})
export class FacebookModule {}
