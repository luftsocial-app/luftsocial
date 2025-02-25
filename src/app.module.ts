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
import { User } from './entities/users/user.entity';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';
import { RolesGuard } from './guards/role-guard';
import { Role } from './entities/roles/role.entity';
import { Permissions } from './entities/roles/permissions.entity';
import { Tenant } from './entities/users/tenant.entity';
import { DatabaseModule } from './database/database.module';
import { PostsModule } from './post-management/posts/posts.module';
import { Post } from './entities/posts/post.entity';
import { Conversation } from './entities/chats/conversation.entity';
import { ChatParticipants } from './entities/chats/chat-participants.entity';
import { UserRoleChange } from './entities/roles/user-role-change.entity';
import { Notification } from './entities/notifications/notification.entity';
import { Team } from './entities/users/team.entity';
import { UserTenant } from './entities/users/user-tenant.entity';
import { MessageModule } from './messaging/message/message.module';
import { Message } from './entities/chats/message.entity';
import { ChatModule } from './messaging/chat/chat.module';
import { TenantModule } from './user-management/tenant/tenant.module';
import { TaskModule } from './task/task.module';
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
        Role,
        Conversation,
        // Notification,
        Message,
        ChatParticipants,
        Notification,
        Post,
        Team,
        UserTenant,
        ChatModule,
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

    HealthModule,
    MessageModule,
    // NotificationModule,
    ScheduleModule.forRoot(),
    UsersModule,
    HealthModule,
    DatabaseModule,
    PostsModule,
    MessageModule,
    TenantModule,
    TaskModule,
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
