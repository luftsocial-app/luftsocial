import {
  Controller,
  Body,
  Post,
  HttpStatus,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ClerkWebhookService } from './clerk-webhook.service';
import { Public } from '../../decorators/public.decorator';
import { WebhookEvent } from '@clerk/express';
import { PinoLogger } from 'nestjs-pino';
import {
  CLERK_WEBHOOK_QUEUE_NAME,
  CLERK_WEBHOOK_QUEUE_PROCESS_NAME_JOB,
} from '../../bull-queue/constants';

@Controller('/webhooks')
export class ClerkWebhookController {
  constructor(
    private readonly clerkWebhookService: ClerkWebhookService,
    @InjectQueue(CLERK_WEBHOOK_QUEUE_NAME) private clerkWebhookQueue: Queue,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ClerkWebhookController.name);
  }

  @Public()
  @Post()
  async handleWebhook(@Body() payload: WebhookEvent, @Req() req: Request) {
    try {
      const evt = await this.clerkWebhookService.verifyWebhook(
        payload,
        req.headers,
      );

      // Queue the verified event instead of processing it directly
      await this.clerkWebhookQueue.add(CLERK_WEBHOOK_QUEUE_PROCESS_NAME_JOB, {
        event: evt,
        headers: req.headers,
        timestamp: Date.now(),
      });

      return HttpStatus.OK;
    } catch (error) {
      this.logger.error('Webhook processing failed:', error);
      throw new BadRequestException(error.message);
    }
  }
}
