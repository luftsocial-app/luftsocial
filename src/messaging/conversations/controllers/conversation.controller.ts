// External dependencies
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

// Internal dependencies
import { ChatGuard } from '../../../guards/chat.guard';
import { CurrentUser } from '../../../decorators/current-user.decorator';

// DTOs
import {
  AddParticipantsDto,
  CreateConversationDto,
  UpdateConversationSettingsDto,
} from '../dto/conversation.dto';
import { CreateMessageDto } from '../../messages/dto/message.dto';

// Entities
import { ConversationEntity } from '../entities/conversation.entity';

// Services
import { ConversationService } from '../services/conversation.service';

@ApiTags('Conversations')
@ApiBearerAuth()
@Controller('conversations')
@UseGuards(ChatGuard)
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @ApiOperation({ summary: 'Create or get a direct chat with another user' })
  @ApiParam({ name: 'userId', description: 'ID of the user to chat with' })
  @ApiResponse({
    status: 200,
    description: 'Direct conversation found or created successfully',
    type: ConversationEntity,
  })
  @Post('direct/:userId')
  async createOrGetDirectChat(
    @CurrentUser() user,
    @Param('userId') otherUserId: string,
  ) {
    return await this.conversationService.createOrGetDirectChat(
      user.id,
      otherUserId,
    );
  }

  @ApiOperation({ summary: 'Create a new group chat' })
  @ApiBody({ type: CreateConversationDto })
  @ApiResponse({
    status: 201,
    description: 'Group conversation created successfully',
    type: ConversationEntity,
  })
  @Post('group')
  async createGroupChat(
    @CurrentUser() user,
    @Body() createGroupDto: CreateConversationDto,
  ) {
    return await this.conversationService.createGroupChat(
      createGroupDto.name,
      createGroupDto.participantIds,
      user.id,
    );
  }

  @ApiOperation({ summary: 'Get all conversations for the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of conversations retrieved successfully',
    type: [ConversationEntity],
  })
  @Get()
  async getMyConversations(@CurrentUser() user) {
    return await this.conversationService.getConversationsByUserId(user.id);
  }

  @ApiOperation({ summary: 'Get a specific conversation by ID' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({
    status: 200,
    description: 'Conversation retrieved successfully',
    type: ConversationEntity,
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @Get(':id')
  async getConversation(@Param('id') id: string) {
    return await this.conversationService.getConversation(id);
  }

  @ApiOperation({ summary: 'Add participants to a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiBody({ type: AddParticipantsDto })
  @ApiResponse({
    status: 200,
    description: 'Participants added successfully',
    type: ConversationEntity,
  })
  @ApiResponse({ status: 403, description: 'Only admins can add participants' })
  @ApiResponse({
    status: 409,
    description: 'Cannot add participants to direct chat',
  })
  @Post(':id/participants')
  async addParticipantsToConversation(
    @CurrentUser() user,
    @Param('id') conversationId: string,
    @Body() body: AddParticipantsDto,
  ) {
    return await this.conversationService.addParticipantsToGroup(
      conversationId,
      body.participantIds,
      user.id,
    );
  }

  @ApiOperation({ summary: 'Update conversation settings' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiBody({ type: UpdateConversationSettingsDto })
  @ApiResponse({
    status: 200,
    description: 'Conversation settings updated successfully',
    type: ConversationEntity,
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions to update settings',
  })
  @Patch(':id/settings')
  async updateConversationSettings(
    @CurrentUser() user,
    @Param('id') conversationId: string,
    @Body() settings: UpdateConversationSettingsDto,
  ) {
    return await this.conversationService.updateConversationSettings(
      conversationId,
      settings,
      user.id,
    );
  }
}
