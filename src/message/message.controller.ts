import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { MessageService } from './message.service';

import { Request, Response } from 'express';

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get('history/:userId')
  async getMessageHistory(
    @Req() req: Request,
    @Param('userId') userId: number,
    @Res() res: Response,
  ) {
    try {
      const { data, status } =
        await this.messageService.getMessageHistory(userId);
      if (status === 1) {
        return res.status(HttpStatus.OK).json({
          message: 'Message history fetched successfully.',
          status: 1,
          data,
        });
      }
    } catch (err) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'An error occurred while fetching message history.',
        error: err.message,
      });
    }
  }
}
