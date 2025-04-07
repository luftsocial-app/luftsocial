import { Module } from '@nestjs/common';
import { FacebookPageMetricsJob } from './jobs/page_metrics-collection.job';
import { FacebookController } from './facebook.controller';
import { FacebookRepository } from './repositories/facebook.repository';
import { FacebookPageInsightsJob } from './jobs/page-insight.job';
import { FacebookService } from './facebook.service';
import { FacebookPostMetricsJob } from './jobs/post-metrics-collection.job';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaStorageModule } from '../../asset-management/media-storage/media-storage.module';
import { PlatformAuthModule } from '../../platform-auth/platform-auth.module';
import { AuthState } from '../entities/facebook-entities/auth-state.entity';
import { FacebookAccount } from '../entities/facebook-entities/facebook-account.entity';
import { FacebookPageMetric } from '../entities/facebook-entities/facebook-page-metric.entity';
import { FacebookPage } from '../entities/facebook-entities/facebook-page.entity';
import { FacebookPostMetric } from '../entities/facebook-entities/facebook-post-metric.entity';
import { FacebookPost } from '../entities/facebook-entities/facebook-post.entity';
import { SocialAccount } from '../entities/notifications/entity/social-account.entity';
import { UserManagementModule } from '../../user-management/user-management.module';

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
    MediaStorageModule,
    UserManagementModule
  ],
  exports: [FacebookService],
})
export class FacebookModule {}
