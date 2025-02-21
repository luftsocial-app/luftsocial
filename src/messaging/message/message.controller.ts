import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  HttpStatus,
  Query,
  UseGuards,
  Body,
  Post,
} from '@nestjs/common';
import { MessageService } from './message.service';

import { Request, Response } from 'express';
import { ChatGuard } from '../../guards/chat.guard';
import { Throttle } from '@nestjs/throttler';
import { MessageQueryDto } from '../dtos/conversation.dto';

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @UseGuards(ChatGuard)
  @Get(':conversationId/messages')
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query() query: MessageQueryDto,
  ) {
    return this.messageService.getMessages(conversationId, query);
  }

  @UseGuards(ChatGuard)
  @Post('conversations/:conversationId/messages')
  // @UseGuards(ThrottlerGuard)
  @Throttle({ rate: { limit: 5, ttl: 10 } }) // 5 requests per 30 seconds
  async createMessage(
    @Param('conversationId') conversationId: string,
    @Body('content') content: string,
  ) {
    return this.messageService.createMessage(conversationId, content);
  }

  @Get('history/:userId')
  async getMessageHistory(
    @Req() req: Request,
    @Param('userId') userId: string,
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
