// External dependencies
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';

// Internal dependencies
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { ResponseInterceptor } from '../../shared/interceptors/response.interceptor';

// DTOs
import { MessageQueryDto } from '../../conversations/dto/conversation.dto';
import {
  CreateMessageDto,
  PrepareAttachmentDto,
  ReactionDto,
  UpdateMessageDto,
} from '../dto/message.dto';
import {
  AttachmentResponseDto,
  MessageListResponseDto,
  MessageResponseDto,
  MessageWithRelationsDto,
} from '../dto/message-response.dto';

// Services
import { MessageService } from '../services/message.service';
import { AuthObject } from '@clerk/express';

@ApiTags('Messages')
@ApiBearerAuth()
@Controller('messages')
@UseInterceptors(ResponseInterceptor)
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  // Get messages from conversationId

  @ApiOperation({ summary: 'Get messages from a conversation' })
  @ApiParam({
    name: 'conversationId',
    description: 'ID of the conversation',
    type: String,
  })
  @ApiQuery({ type: MessageQueryDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Messages retrieved successfully',
    type: MessageListResponseDto,
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  @Get('conversations/:conversationId')
  async getMessages(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() query: Omit<MessageQueryDto, 'conversationId'>,
  ): Promise<MessageListResponseDto> {
    return this.messageService.getMessages(conversationId, {
      ...query,
      conversationId,
    });
  }

  // Create mesaage
  @ApiOperation({ summary: 'Create a new message' })
  @ApiBody({ type: CreateMessageDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Message created successfully',
    type: MessageResponseDto,
  })
  @UseGuards(ThrottlerGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createMessage(
    @CurrentUser() user: AuthObject,
    @Body() messageDto: CreateMessageDto,
  ): Promise<MessageResponseDto> {
    return this.messageService.createMessage(
      messageDto.conversationId,
      messageDto.content,
      user.userId,
      messageDto.parentMessageId,
      messageDto.uploadSessionId,
    );
  }

  // Get Message History
  @ApiOperation({ summary: 'Get message history for a user' })
  @ApiParam({ name: 'userId', description: 'ID of the user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Message history retrieved successfully',
    type: MessageResponseDto,
    isArray: true,
  })
  @Get('history/:userId')
  getMessageHistory(
    @CurrentUser() user: AuthObject,
    @Param('userId') userId: string,
  ): Promise<MessageResponseDto[]> {
    // We use the requested userId, but authenticate via the current user
    return this.messageService.getMessageHistory(userId);
  }

  // Get Message by ID
  @ApiOperation({ summary: 'Get message by ID' })
  @ApiParam({ name: 'id', description: 'ID of the message' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Message retrieved successfully',
    type: MessageWithRelationsDto,
  })
  @Get(':id')
  getMessage(
    @CurrentUser() user: AuthObject,
    @Param('id', ParseUUIDPipe) messageId: string,
  ): Promise<MessageWithRelationsDto> {
    return this.messageService.findMessageById(messageId, user.userId);
  }

  // Update Message
  @ApiOperation({ summary: 'Update a message' })
  @ApiParam({ name: 'id', description: 'ID of the message to update' })
  @ApiBody({ type: UpdateMessageDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Message updated successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Message not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not authorized to update message',
  })
  @Patch(':id')
  updateMessage(
    @CurrentUser() user: AuthObject,
    @Param('id', ParseUUIDPipe) messageId: string,
    @Body() updateMessageDto: UpdateMessageDto,
  ): Promise<MessageResponseDto> {
    return this.messageService.updateMessage(
      messageId,
      updateMessageDto,
      user.userId,
    );
  }

  // Delete Message
  @ApiOperation({ summary: 'Delete a message' })
  @ApiParam({ name: 'id', description: 'ID of the message to delete' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Message deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Message not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not authorized to delete message',
  })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMessage(
    @CurrentUser() user: AuthObject,
    @Param('id', ParseUUIDPipe) messageId: string,
  ): Promise<void> {
    return this.messageService.deleteMessage(messageId, user.userId);
  }

  // Add Reaction
  @ApiOperation({ summary: 'Add a reaction to a message' })
  @ApiParam({ name: 'id', description: 'ID of the message' })
  @ApiBody({ type: ReactionDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reaction added successfully',
    type: MessageResponseDto,
  })
  @Post(':id/reactions')
  addReaction(
    @CurrentUser() user: AuthObject,
    @Param('id', ParseUUIDPipe) messageId: string,
    @Body() reactionDto: ReactionDto,
  ): Promise<MessageResponseDto> {
    return this.messageService.addReaction(
      messageId,
      user.userId,
      reactionDto.emoji,
    );
  }

  // Remove Reaction
  @ApiOperation({ summary: 'Remove a reaction from a message' })
  @ApiParam({ name: 'id', description: 'ID of the message' })
  @ApiBody({ type: ReactionDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reaction removed successfully',
    type: MessageResponseDto,
  })
  @Delete(':id/reactions')
  removeReaction(
    @CurrentUser() user: AuthObject,
    @Param('id', ParseUUIDPipe) messageId: string,
    @Body() reactionDto: ReactionDto,
  ): Promise<MessageResponseDto> {
    return this.messageService.removeReaction(
      messageId,
      user.userId,
      reactionDto.emoji,
    );
  }

  // Get Attachments
  @ApiOperation({ summary: 'Get attachments for a message' })
  @ApiParam({ name: 'id', description: 'ID of the message' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Attachments retrieved successfully',
    type: [AttachmentResponseDto],
  })
  @Get(':id/attachments')
  getAttachments(
    @Param('id', ParseUUIDPipe) messageId: string,
  ): Promise<AttachmentResponseDto[]> {
    return this.messageService.getAttachments(messageId);
  }

  // Get Thread Replies
  @ApiOperation({ summary: 'Get thread replies' })
  @ApiParam({ name: 'id', description: 'ID of the parent message' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Thread replies retrieved successfully',
    type: [MessageResponseDto],
  })
  @Get(':id/replies')
  getThreadReplies(
    @Param('id', ParseUUIDPipe) messageId: string,
  ): Promise<MessageResponseDto[]> {
    return this.messageService.getThreadReplies(messageId);
  }

  @ApiOperation({ summary: 'Mark message as read' })
  @ApiParam({ name: 'id', description: 'ID of the message' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Message marked as read successfully',
  })
  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAsRead(
    @CurrentUser() user: AuthObject,
    @Param('id', ParseUUIDPipe) messageId: string,
  ): Promise<void> {
    return this.messageService.markMessageAsRead(messageId, user.userId);
  }

  @ApiOperation({ summary: 'Get unread message count' })
  @ApiParam({ name: 'conversationId', description: 'ID of the conversation' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Unread count retrieved successfully',
    schema: {
      type: 'number',
    },
  })
  @Get('unread/:conversationId')
  getUnreadCount(
    @CurrentUser() user: AuthObject,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ): Promise<number> {
    return this.messageService.getUnreadCount(conversationId, user.userId);
  }

  // ATACHMENT CONTROLLER

  @HttpCode(HttpStatus.CREATED)
  @Post('attachments')
  @ApiOperation({ summary: 'Get presigned URL for file upload' })
  async prepareAttachmentUpload(
    @CurrentUser() user: AuthObject,
    @Body() dto: PrepareAttachmentDto,
  ) {
    return this.messageService.prepareAttachment(
      user.userId,
      dto.fileName,
      dto.conversationId,
      dto.uploadSessionId,
    );
  }

  @Post('attachments/:id/confirm')
  @ApiOperation({ summary: 'Confirm successful file upload' })
  async finalizeAttachment(@Param('id') attachmentId: string) {
    return this.messageService.confirmAttachment(attachmentId);
  }
}
