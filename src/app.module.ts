import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { LoggerModule } from 'nestjs-pino';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { RequestInterceptor } from './interceptors/request-interceptor-2';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import * as config from 'config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { ScheduleModule } from '@nestjs/schedule';
import { TenantMiddleware } from './middleware/tenant.middleware';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';
import { RolesGuard } from './guards/role-guard';
import { TaskModule } from './task/task.module';
import { MediaStorageModule } from './asset-management/media-storage/media-storage.module';
import { CacheModule } from './cache/cache.module';
import { PlatformsModule } from './platforms/platforms.module';
import { FacebookModule } from './platforms/facebook/facebook.module';
import { MessagingModule } from './messaging/messaging.module';

// Entity imports
import { User } from './user-management/entities/user.entity';
import { UserRoleChange } from './user-management/entities/user-role-change.entity';
import { Permissions } from './user-management/entities/permissions.entity';
import { Role as RoleEntity } from './user-management/entities/role.entity';
import { ConversationEntity } from './messaging/conversations/entities/conversation.entity';
import { MessageEntity } from './messaging/messages/entities/message.entity';
import { AttachmentEntity } from './messaging/messages/entities/attachment.entity';
import { InstagramModule } from './platforms/instagram/instagram.module';
import { AuthState } from './platforms/entities/facebook-entities/auth-state.entity';
import { FacebookAccount } from './platforms/entities/facebook-entities/facebook-account.entity';
import { FacebookPageMetric } from './platforms/entities/facebook-entities/facebook-page-metric.entity';
import { FacebookPage } from './platforms/entities/facebook-entities/facebook-page.entity';
import { FacebookPostMetric } from './platforms/entities/facebook-entities/facebook-post-metric.entity';
import { FacebookPost } from './platforms/entities/facebook-entities/facebook-post.entity';
import { ParticipantEntity } from './messaging/conversations/entities/participant.entity';
import { CrossPlatformModule } from './cross-platform/cross-platform.module';
import { ConversationModule } from './messaging/conversations/conversation.module';
import { RealtimeModule } from './messaging/realtime/realtime.module';
import { ClerkWebhookModule } from './webhooks/clerk-webhook/clerk-webhook.module';
import { SocialAccount } from './platforms/entities/notifications/entity/social-account.entity';
import { Team } from './user-management/entities/team.entity';
import { Tenant } from './user-management/entities/tenant.entity';
import { Notification } from './platforms/entities/notifications/notification.entity';
import { TiktokModule } from './webhooks/tiktok/tiktok.module';
import { PostAsset } from './asset-management/entities/post-asset.entity';
import { UserManagementModule } from './user-management/user-management.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      // ignoreEnvFile: true,
      // ignoreEnvVars: true,
      isGlobal: true,
      load: [config.util.toObject],
    }),
    TypeOrmModule.forRoot({
      ...config.get('db.options'),
      entities: [
        User,
        Tenant,
        UserRoleChange,
        Permissions,
        RoleEntity,
        ConversationEntity,
        MessageEntity,
        AttachmentEntity,
        Team,
        Notification,
        FacebookPostMetric,
        FacebookPost,
        FacebookPage,
        FacebookPageMetric,
        AuthState,
        ParticipantEntity,
        FacebookAccount,
        SocialAccount,
        PostAsset,
      ],
    }),
    LoggerModule.forRoot({
      ...JSON.parse(JSON.stringify(config.get('logger'))),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 5,
      },
    ]),
    RealtimeModule,
    ClerkWebhookModule,
    MessagingModule,
    HealthModule,
    ScheduleModule.forRoot(),
    HealthModule,
    MediaStorageModule,
    CacheModule,
    FacebookModule,
    InstagramModule,
    PlatformsModule,
    CrossPlatformModule,
    ConversationModule,
    UserManagementModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
    consumer
      .apply(TenantMiddleware)
      .exclude({ path: 'webhooks', method: RequestMethod.ALL })
      .exclude({ path: 'webhooks/*', method: RequestMethod.ALL })
      .forRoutes('*');
  }
}
