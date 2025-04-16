import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullConfigService } from './bull-config.service';
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
          host: configService.get('REDIS_HOST') || 'localhost',
          port: parseInt(configService.get('REDIS_PORT') || '6379'),
          password: configService.get('REDIS_PASSWORD'),
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
  providers: [BullConfigService],
  exports: [BullModule],
})
export class BullQueueModule {}
