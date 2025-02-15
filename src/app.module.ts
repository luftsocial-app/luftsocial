import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { LoggerModule } from 'nestjs-pino';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { RequestInterceptor } from './interceptors/request-interceptor-2';
import { RoleGuard } from './guards/role-guard';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import * as config from 'config';
import { TypeOrmModule } from '@nestjs/typeorm';
// import { LoggerMiddleware } from '../logger.middleware';
import { ScheduleModule } from '@nestjs/schedule';
import { UserModule } from './user/user.module';
import { Users } from './entities/user.entity';
import { PlatformsModule } from './platforms/platforms.module';
import { CrossPlatformModule } from './cross-platform/cross-platform.module';
import { AuthModule } from './auth/auth.module';
import { ClerkMiddleware } from './middleware/clerk.middleware';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    UserModule,
    ConfigModule.forRoot({
      ignoreEnvFile: true,
      ignoreEnvVars: true,
      isGlobal: true,
      load: [config.util.toObject],
    }),
    TypeOrmModule.forRoot({
      ...config.get('db.options'),
      entities: [Users],
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
    PlatformsModule,
    CrossPlatformModule,
    AuthModule,
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
      useClass: RoleGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ClerkMiddleware).forRoutes('*'); // Apply Clerk to all routes
  }
}
