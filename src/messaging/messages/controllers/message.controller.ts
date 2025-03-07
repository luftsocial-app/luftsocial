import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { MessageService } from '../services/message.service';
import { ChatGuard } from '../../../guards/chat.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { MessageQueryDto } from '../../conversations/dto/conversation.dto';
import { CreateMessageDto, UpdateMessageDto, ReactionDto } from '../dto/message.dto';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { ResponseInterceptor } from '../../shared/interceptors/response.interceptor';
import {
  MessageResponseDto,
  MessageWithRelationsDto,
  MessageListResponseDto,
  AttachmentResponseDto
} from '../dto/message-response.dto';

@ApiTags('Messages')
@ApiBearerAuth()
@Controller('messages')
@UseGuards(ChatGuard)
@UseInterceptors(ResponseInterceptor)
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @ApiOperation({ summary: 'Get messages from a conversation' })
  @ApiParam({ 
    name: 'conversationId', 
    description: 'ID of the conversation',
    type: String 
  })
  @ApiQuery({ type: MessageQueryDto })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Messages retrieved successfully',
    type: MessageListResponseDto
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  @Get('conversations/:conversationId')
  getMessages(
    @CurrentUser() user,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() query: MessageQueryDto,
  ): Promise<MessageListResponseDto> {
    return this.messageService.getMessages(conversationId, query);
  }

  @ApiOperation({ summary: 'Create a new message' })
  @ApiBody({ type: CreateMessageDto })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Message created successfully',
    type: MessageResponseDto
  })
  @UseGuards(ThrottlerGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createMessage(
    @CurrentUser() user,
    @Body() messageDto: CreateMessageDto,
  ): Promise<MessageResponseDto> {
    return this.messageService.createMessage(
      messageDto.conversationId,
      messageDto.content,
      user.id,
      messageDto.parentMessageId,
    );
  }

  @ApiOperation({ summary: 'Get message history for a user' })
  @ApiParam({ name: 'userId', description: 'ID of the user' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Message history retrieved successfully',
    type: MessageResponseDto,
    isArray: true
  })
  @Get('history/:userId')
  getMessageHistory(
    @CurrentUser() user,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<MessageResponseDto[]> {
    // We use the requested userId, but authenticate via the current user
    return this.messageService.getMessageHistory(userId);
  }

  @ApiOperation({ summary: 'Get message by ID' })
  @ApiParam({ name: 'id', description: 'ID of the message' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Message retrieved successfully',
    type: MessageWithRelationsDto
  })
  @Get(':id')
  getMessage(
    @CurrentUser() user,
    @Param('id', ParseUUIDPipe) messageId: string,
  ): Promise<MessageWithRelationsDto> {
    return this.messageService.findMessageById(messageId, user.id);
  }

  @ApiOperation({ summary: 'Update a message' })
  @ApiParam({ name: 'id', description: 'ID of the message to update' })
  @ApiBody({ type: UpdateMessageDto })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Message updated successfully',
    type: MessageResponseDto
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Message not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not authorized to update message' })
  @Patch(':id')
  updateMessage(
    @CurrentUser() user,
    @Param('id', ParseUUIDPipe) messageId: string,
    @Body() updateMessageDto: UpdateMessageDto,
  ): Promise<MessageResponseDto> {
   
    return this.messageService.updateMessage(messageId, updateMessageDto, user.id);
  }

  @ApiOperation({ summary: 'Delete a message' })
  @ApiParam({ name: 'id', description: 'ID of the message to delete' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Message deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Message not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not authorized to delete message' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMessage(
    @CurrentUser() user,
    @Param('id', ParseUUIDPipe) messageId: string,
  ): Promise<void> {
    return this.messageService.deleteMessage(messageId, user.id);
  }

  @ApiOperation({ summary: 'Add a reaction to a message' })
  @ApiParam({ name: 'id', description: 'ID of the message' })
  @ApiBody({ type: ReactionDto })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Reaction added successfully',
    type: MessageResponseDto
  })
  @Post(':id/reactions')
  addReaction(
    @CurrentUser() user,
    @Param('id', ParseUUIDPipe) messageId: string,
    @Body() reactionDto: ReactionDto,
  ): Promise<MessageResponseDto> {
    return this.messageService.addReaction(messageId, user.id, reactionDto.emoji);
  }

  @ApiOperation({ summary: 'Remove a reaction from a message' })
  @ApiParam({ name: 'id', description: 'ID of the message' })
  @ApiBody({ type: ReactionDto })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Reaction removed successfully',
    type: MessageResponseDto
  })
  @Delete(':id/reactions')
  removeReaction(
    @CurrentUser() user,
    @Param('id', ParseUUIDPipe) messageId: string,
    @Body() reactionDto: ReactionDto,
  ): Promise<MessageResponseDto> {
    return this.messageService.removeReaction(messageId, user.id, reactionDto.emoji);
  }

  @ApiOperation({ summary: 'Get attachments for a message' })
  @ApiParam({ name: 'id', description: 'ID of the message' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Attachments retrieved successfully',
    type: [AttachmentResponseDto]
  })
  @Get(':id/attachments')
  getAttachments(
    @Param('id', ParseUUIDPipe) messageId: string,
  ): Promise<AttachmentResponseDto[]> {
    return this.messageService.getAttachments(messageId);
  }

  @ApiOperation({ summary: 'Get thread replies' })
  @ApiParam({ name: 'id', description: 'ID of the parent message' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Thread replies retrieved successfully',
    type: [MessageResponseDto]
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
    description: 'Message marked as read successfully' 
  })
  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAsRead(
    @CurrentUser() user,
    @Param('id', ParseUUIDPipe) messageId: string,
  ): Promise<void> {
    return this.messageService.markMessageAsRead(messageId, user.id);
  }

  @ApiOperation({ summary: 'Get unread message count' })
  @ApiParam({ name: 'conversationId', description: 'ID of the conversation' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Unread count retrieved successfully',
    schema: {
      type: 'number'
    }
  })
  @Get('unread/:conversationId')
  getUnreadCount(
    @CurrentUser() user,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ): Promise<number> {
    return this.messageService.getUnreadCount(conversationId, user.id);
  }
} 