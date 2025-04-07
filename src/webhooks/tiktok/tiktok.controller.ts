import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Public } from '../../decorators/public.decorator';

@Controller('webhooks')
export class TiktokController {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(TiktokController.name);
  }

  @Public()
  @Post('tiktok')
  @HttpCode(HttpStatus.OK)
  async handleTiktokWebhook(@Body() tiktokWebhookDto: any) {
    try {
      this.logger.info('Received webhook from Tiktok:', tiktokWebhookDto);
      return new Response('Webhook received from tiktok', { status: 200 });
    } catch (error) {
      throw new HttpException(
        error.message,
        error instanceof BadRequestException
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
