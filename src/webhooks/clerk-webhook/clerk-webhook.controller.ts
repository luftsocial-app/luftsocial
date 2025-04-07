import {
  Controller,
  Body,
  Post,
  HttpException,
  HttpStatus,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { ClerkWebhookService } from './clerk-webhook.service';
import { Public } from '../../decorators/public.decorator';
import { WebhookEvent } from '@clerk/express';
import { PinoLogger } from 'nestjs-pino';

@Controller('/webhooks')
export class ClerkWebhookController {
  constructor(
    private readonly clerkWebhookService: ClerkWebhookService,
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
      await this.clerkWebhookService.processWebhookEvent(evt);
      return HttpStatus.OK;
    } catch (error) {
      this.logger.error('Webhook processing failed:', error);
      throw new HttpException(
        error.message,
        error instanceof BadRequestException
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
