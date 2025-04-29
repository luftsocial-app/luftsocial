import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  CLERK_WEBHOOK_QUEUE_NAME,
  CONTENT_PLATFORM_PUBLISH,
} from './constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('bull.redis.host') || 'localhost',
          port: parseInt(configService.get('bull.redis.port') || '6379'),
          username: configService.get('bull.redis.username') || 'default',
          password: configService.get('bull.redis.password'),
          url: configService.get('redis.renderTestURL'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      {
        name: CLERK_WEBHOOK_QUEUE_NAME,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      },
      {
        name: CONTENT_PLATFORM_PUBLISH,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      },
      { name: 'other-event-type' },
    ),
  ],
  exports: [BullModule],
})
export class BullQueueModule {}
