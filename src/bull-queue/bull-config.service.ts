import { Injectable } from '@nestjs/common';
import { SharedBullConfigurationFactory } from '@nestjs/bullmq';
import { QueueOptions } from 'bullmq';

@Injectable()
export class BullConfigService implements SharedBullConfigurationFactory {
  createSharedConfiguration(): QueueOptions {
    return {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    };
  }
}
