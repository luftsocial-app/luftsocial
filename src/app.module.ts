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
@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: true,
      ignoreEnvVars: true,
      isGlobal: true,
      load: [config.util.toObject],
    }),
    TypeOrmModule.forRoot({
      //...config.get('db.options'),
      type: 'postgres',
      host: 'localhost',
      port: 5434,
      username: 'root', 
      password: 'admin',
      database: 'start-template',
      synchronize: false,
      logging: 'all',
          logger: 'advanced-console',

          entities: ['dist/**/**.entity{.ts,.js}'],
          migrations: ['dist/config/database/migrations/**/*{.js,.ts}'],
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
