import { Module } from '@nestjs/common';
import { LinkedInMetricsCollectionJob } from './jobs/metrics-collection.job';
import { LinkedInTokenRefreshJob } from './jobs/token-refresh.job';
import { LinkedInService } from './linkedin.service';
import { LinkedInRepository } from './repositories/linkedin.repository';
import { LinkedInController } from './linkedin.controller';
import { LinkedInConfig } from './config/linkedin.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LinkedInAccount } from '../../entities/socials/linkedin-entities/linkedin-account.entity';
import { LinkedInOrganization } from '../../entities/socials/linkedin-entities/linkedin-organization.entity';
import { LinkedInMetric, LinkedInPost } from '../../entities/socials/linkedin-entities/linkedin-post.entity';
import { DatabaseModule } from '../../database/database.module';
import { ConfigModule } from '@nestjs/config';
import { PlatformAuthModule } from '../../platform-auth/platform-auth.module';
import { MediaStorageModule } from '../../asset-management/media-storage/media-storage.module';
import { SocialAccount } from '../../entities/notifications/entity/social-account.entity';
import { AuthState } from '../../entities/socials/facebook-entities/auth-state.entity';

@Module({
  controllers: [LinkedInController],
  imports: [
    ConfigModule,
    DatabaseModule,
    MediaStorageModule,
    PlatformAuthModule,
    TypeOrmModule.forFeature([
      LinkedInAccount,
      LinkedInOrganization,
      LinkedInPost,
      LinkedInMetric,
      AuthState,
      SocialAccount,
    ]),
  ],
  providers: [
    LinkedInService,
    LinkedInRepository,
    LinkedInMetricsCollectionJob,
    LinkedInConfig,
    LinkedInTokenRefreshJob,
  ],
  exports: [LinkedInService],
})
export class LinkedInModule { }
