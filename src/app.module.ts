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
// import { LoggerMiddleware } from '../logger.middleware';
import { ScheduleModule } from '@nestjs/schedule';
// import { UsersModule } from ""
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/groupMembers.entity';
import { GroupModule } from './group/group.module'
import { GroupMemberModule } from './group-member/group-member.module';
import { MessageModule } from './message/message.module';
import { NotificationModule } from './notification/notification.module';

import { Message } from './entities/message.entity';
import { TenantMiddleware } from './middleware/tenant.middleware';
import { UsersModule } from './user-management/users/users.module';
import { Users } from './entities/user.entity';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';
import { RolesGuard } from './guards/role-guard';
import { Role } from './entities/role.entity';
import { Permissions } from './entities/permissions.entity';
import { Tenant } from './entities/tenant.entity';
import { DatabaseModule } from './database/database.module';
import { PostsModule } from './post-management/posts/posts.module';
import { Post } from './entities/post.entity';
import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-members.entity';
import { UserRoleChange } from './entities/user-role-change.entity';
import { Notification } from './entities/notification.entity';
import { MessageRead } from './entities/message-read.entity';
import { UserTenant } from './entities/user-tenant.entity';
import { Team } from './entities/team.entity';
@Module({
  imports: [
    ScheduleModule.forRoot(),
    UsersModule,
    ConfigModule.forRoot({
      // ignoreEnvFile: true,
      // ignoreEnvVars: true,
      isGlobal: true,
      load: [config.util.toObject],
    }),
    TypeOrmModule.forRoot({
      ...config.get('db.options'),
      entities: [
        Users,
        Tenant,
        UserRoleChange,
        Permissions,
        Role,
        Message,
        MessageRead,
        Conversation,
        ConversationMember,
        Notification,
        Post,
        Team,
        UserTenant,
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
    GroupModule,
    GroupMemberModule,
    MessageModule,
    NotificationModule,
    UsersModule,
    DatabaseModule,
    PostsModule,
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
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
