import { Module } from '@nestjs/common';
import { LinkedInMetricsCollectionJob } from './jobs/metrics-collection.job';
import { LinkedInTokenRefreshJob } from './jobs/token-refresh.job';
import { LinkedInService } from './linkedin.service';
import { LinkedInRepository } from './repositories/linkedin.repository';
import { LinkedInController } from './linkedin.controller';
import { LinkedInConfig } from './config/linkedin.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LinkedInAccount } from '../entities/linkedin-entities/linkedin-account.entity';
import { LinkedInOrganization } from '../entities/linkedin-entities/linkedin-organization.entity';
import {
  LinkedInMetric,
  LinkedInPost,
} from '../entities/linkedin-entities/linkedin-post.entity';
import { ConfigModule } from '@nestjs/config';
import { PlatformAuthModule } from '../../platform-auth/platform-auth.module';
import { MediaStorageModule } from '../../asset-management/media-storage/media-storage.module';
import { AuthState } from '../entities/facebook-entities/auth-state.entity';
import { UserManagementModule } from '../../user-management/user-management.module';

@Module({
  controllers: [LinkedInController],
  imports: [
    ConfigModule,
    UserManagementModule,
    MediaStorageModule,
    PlatformAuthModule,
    TypeOrmModule.forFeature([
      LinkedInAccount,
      LinkedInOrganization,
      LinkedInPost,
      LinkedInMetric,
      AuthState,
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
export class LinkedInModule {}
