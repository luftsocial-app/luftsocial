import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PublishRecord } from '../entities/publish.entity';
import { RetryQueueItem } from '../helpers/cross-platform.interface';
import {
  CONTENT_PLATFORM_PUBLISH,
  CONTENT_PLATFORM_RETRY_PUBLISH_JOB,
} from '../../bull-queue/constants';

@Injectable()
export class RetryQueueService {
  private readonly logger = new Logger(RetryQueueService.name);
  private readonly MAX_RETRIES = 5;

  constructor(
    @InjectQueue(CONTENT_PLATFORM_PUBLISH) private publishQueue: Queue,
    @InjectRepository(PublishRecord)
    private readonly publishRepo: Repository<PublishRecord>,
  ) {}

  /**
   * Add a failed publish attempt to the retry queue
   */
  async addToRetryQueue(item: RetryQueueItem): Promise<void> {
    try {
      this.logger.log(
        `Adding to retry queue: ${item.platform} for record ${item.publishRecordId}, retry #${item.retryCount}`,
      );

      // Calculate delay with exponential backoff
      const delayMs = this.calculateBackoffDelay(item.retryCount);

      // Add to queue with appropriate options
      await this.publishQueue.add(CONTENT_PLATFORM_RETRY_PUBLISH_JOB, item, {
        delay: delayMs,
        attempts: 1, // We'll handle retries ourselves
        backoff: {
          type: 'exponential',
          delay: 60000, // Initial delay (1 minute)
        },
        removeOnComplete: false, // Keep completed jobs for tracking
        removeOnFail: false, // Keep failed jobs for tracking
      });

      // Update publish record to indicate retry is scheduled
      await this.updatePublishRecord(item);

      this.logger.log(
        `Added to retry queue: ${item.platform} for record ${item.publishRecordId}, will retry in ${delayMs / 1000} seconds`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to add to retry queue: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Update the publish record to reflect the scheduled retry
   */
  private async updatePublishRecord(item: RetryQueueItem): Promise<void> {
    try {
      const record = await this.publishRepo.findOne({
        where: { id: item.publishRecordId },
      });

      if (!record) {
        this.logger.warn(
          `Publish record ${item.publishRecordId} not found for retry update`,
        );
        return;
      }

      // Update the results for this specific platform
      const results = Array.isArray(record.results) ? [...record.results] : [];
      const platformIndex = results.findIndex(
        (r) => r.platform === item.platform && r.userId === item.userId,
      );

      if (platformIndex >= 0) {
        results[platformIndex] = {
          ...results[platformIndex],
          retryScheduled: true,
          retryCount: item.retryCount,
          nextRetryAt: new Date(
            Date.now() + this.calculateBackoffDelay(item.retryCount),
          ),
        };
      }

      await this.publishRepo.update(item.publishRecordId, { results });
    } catch (error) {
      this.logger.error(
        `Failed to update publish record for retry: ${error.message}`,
        error.stack,
      );
    }
  }

  private calculateBackoffDelay(retryCount: number): number {
    // Base delay: 1 minute (60000 ms)
    // Formula: baseDelay * 2^retryCount with some jitter
    const baseDelay = 60000; // 1 minute
    const maxDelay = 3600000; // 1 hour

    // Calculate exponential delay
    let delay = baseDelay * Math.pow(2, retryCount);

    // Add some random jitter (±10%)
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    delay += jitter;

    // Cap at maximum delay
    return Math.min(delay, maxDelay);
  }

  /**
   * Get all pending retries for a publish record
   */
  async getPendingRetries(publishRecordId: string): Promise<any[]> {
    try {
      const jobs = await this.publishQueue.getJobs(['delayed', 'waiting']);

      return jobs
        .filter(
          (job) =>
            job.data.publishRecordId === publishRecordId &&
            job.name === CONTENT_PLATFORM_RETRY_PUBLISH_JOB,
        )
        .map((job) => ({
          id: job.id,
          platform: job.data.platform,
          accountId: job.data.accountId,
          retryCount: job.data.retryCount,
          nextAttempt: new Date(job.timestamp + job.opts.delay),
        }));
    } catch (error) {
      this.logger.error(
        `Failed to get pending retries: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Cancel a pending retry
   */
  async cancelRetry(jobId: string): Promise<boolean> {
    try {
      const job = await this.publishQueue.getJob(jobId);

      if (!job) {
        return false;
      }

      await job.remove();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to cancel retry: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}
