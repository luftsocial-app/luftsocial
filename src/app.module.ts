import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
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
import { LoggerMiddleware } from '../logger.middleware';
import { ScheduleModule } from '@nestjs/schedule';
import { TenantMiddleware } from './middleware/tenant.middleware';
import { UsersModule } from './user-management/users/users.module';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';
import { RolesGuard } from './guards/role-guard';
import { PostsModule } from './post-management/posts/posts.module';
import { TenantModule } from './user-management/tenant/tenant.module';
import { TaskModule } from './task/task.module';
import { MediaStorageModule } from './asset-management/media-storage/media-storage.module';
import { CacheModule } from './cache/cache.module';
import { PlatformsModule } from './platforms/platforms.module';
import { FacebookModule } from './platforms/facebook/facebook.module';
import { DatabaseModule } from './database/database.module';
import { MessagingModule } from './messaging/messaging.module';

// Entity imports
import { User } from './entities/users/user.entity';
import { Tenant } from './entities/users/tenant.entity';
import { UserRoleChange } from './entities/roles/user-role-change.entity';
import { Permissions } from './entities/roles/permissions.entity';
import { Role as RoleEntity } from './entities/roles/role.entity';
import { ConversationEntity } from './messaging/conversations/entities/conversation.entity';
import { MessageEntity } from './messaging/messages/entities/message.entity';
import { AttachmentEntity } from './messaging/messages/entities/attachment.entity';
import { Post as PostEntity } from './entities/posts/post.entity';
import { Team } from './entities/users/team.entity';
import { UserTenant } from './entities/users/user-tenant.entity';
import { Notification } from './entities/notifications/notification.entity';

import { InstagramModule } from './platforms/instagram/instagram.module';
import { SocialAccount } from './entities/notifications/entity/social-account.entity';
import { AuthState } from './entities/socials/facebook-entities/auth-state.entity';
import { FacebookAccount } from './entities/socials/facebook-entities/facebook-account.entity';
import { FacebookPageMetric } from './entities/socials/facebook-entities/facebook-page-metric.entity';
import { FacebookPage } from './entities/socials/facebook-entities/facebook-page.entity';
import { FacebookPostMetric } from './entities/socials/facebook-entities/facebook-post-metric.entity';
import { FacebookPost } from './entities/socials/facebook-entities/facebook-post.entity';
import { ParticipantEntity } from './messaging/conversations/entities/participant.entity';
@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: true,
      ignoreEnvVars: true,
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
        PostEntity,
        Team,
        UserTenant,
        Notification,
        FacebookPostMetric,
        FacebookPost,
        FacebookPage,
        FacebookPageMetric,
        AuthState,
        ParticipantEntity,
        FacebookAccount,
        SocialAccount,
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
    MessagingModule,
    HealthModule,
    ScheduleModule.forRoot(),
    UsersModule,
    HealthModule,
    DatabaseModule,
    PostsModule,
    TenantModule,
    TaskModule,
    MediaStorageModule,
    CacheModule,
    FacebookModule,
    InstagramModule,
    PlatformsModule,
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
    consumer.apply(LoggerMiddleware, TenantMiddleware).forRoutes('*');
  }
}
