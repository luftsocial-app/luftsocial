import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  HttpStatus,
  Query,
  Body,
  Post,
  Patch,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { MessageService } from './message.service';

import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { MessageQueryDto } from '../dtos/conversation.dto';
import { UpdateMessageDto } from '../dtos/message.dto';
import { OperationStatus } from '../../common/enums/operation-status.enum';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../../decorators/current-user.decorator';

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get(':conversationId/messages')
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query() query: MessageQueryDto,
  ) {
    return this.messageService.getMessages(conversationId, query);
  }

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
      } else if (status === 2) {
        res.status(HttpStatus.OK).json({
          status: 2,
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

  @ApiOperation({
    summary: 'Update a message',
    description: 'Updates the content of an existing message',
  })
  @ApiParam({
    name: 'id',
    description: 'ID of the message to update',
  })
  @ApiResponse({ status: 200, description: 'Message updated successfully' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({
    status: 403,
    description: 'User not authorized to update this message',
  })
  @Patch(':id')
  async updateMessage(
    @CurrentUser() user: any,
    @Param('id') messageId: string,
    @Body() updateMessageDto: UpdateMessageDto,
    @Res() res: Response,
  ) {
    try {
      const userId = user.id;
      const updatedMessage = await this.messageService.updateMessage(
        messageId,
        updateMessageDto,
        userId,
      );

      return res.status(HttpStatus.OK).json({
        message: 'Message updated successfully',
        data: updatedMessage,
        status: OperationStatus.Success,
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        return res.status(HttpStatus.NOT_FOUND).json({
          message: error.message,
          status: OperationStatus.NotFound,
        });
      } else if (error instanceof ForbiddenException) {
        return res.status(HttpStatus.FORBIDDEN).json({
          message: error.message,
          status: OperationStatus.Unauthorized,
        });
      }

      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to update message',
        error: error.message,
        status: OperationStatus.Failed,
      });
    }
  }
}
