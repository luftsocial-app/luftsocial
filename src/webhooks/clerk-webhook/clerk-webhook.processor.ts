import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ClerkWebhookService } from './clerk-webhook.service';
import { PinoLogger } from 'nestjs-pino';
import { CLERK_WEBHOOK_QUEUE_NAME } from '../../bull-queue/constants';
import { WebhookJobData, WebhookJobResult } from './types';

@Processor(CLERK_WEBHOOK_QUEUE_NAME)
export class ClerkWebhookProcessor extends WorkerHost {
  constructor(
    private readonly clerkWebhookService: ClerkWebhookService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(ClerkWebhookProcessor.name);
  }

  async process(job: Job<WebhookJobData>): Promise<WebhookJobResult> {
    try {
      this.logger.info(`Processing webhook job ${job.id}`);
      const { event } = job.data;
      await this.clerkWebhookService.processWebhookEvent(event);

      const result: WebhookJobResult = {
        success: true,
        message: 'Webhook processed successfully',
        processedAt: new Date(),
      };

      this.logger.info(`Successfully processed webhook job ${job.id}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process webhook job ${job.id}: ${error.message}`,
      );

      const result: WebhookJobResult = {
        success: false,
        message: error.message,
        processedAt: new Date(),
      };

      throw result;
    }
  }
}
