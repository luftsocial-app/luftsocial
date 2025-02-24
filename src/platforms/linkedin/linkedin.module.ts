import { Module } from '@nestjs/common';
import { LinkedInMetricsCollectionJob } from './jobs/metrics-collection.job';
import { LinkedInTokenRefreshJob } from './jobs/token-refresh.job';
import { LinkedInService } from './linkedin.service';
import { LinkedInRepository } from './repositories/linkedin.repository';
import { LinkedInController } from './linkedin.controller';
import { LinkedInConfig } from './config/linkedin.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LinkedInAccount } from './entities/linkedin-account.entity';
import { LinkedInOrganization } from './entities/linkedin-organization.entity';
import { LinkedInMetric, LinkedInPost } from './entities/linkedin-post.entity';
import { AuthState } from '../facebook/entity/auth-state.entity';
import { SocialAccount } from '../entity/social-account.entity';
import { PlatformAuthModule } from 'src/platform-auth/platform-auth.module';

@Module({
  controllers: [LinkedInController],
  imports: [
    TypeOrmModule.forFeature([
      LinkedInAccount,
      LinkedInOrganization,
      LinkedInPost,
      LinkedInMetric,
      AuthState,
      SocialAccount,
    ]),
    PlatformAuthModule,
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
