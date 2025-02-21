import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGuard } from '../../guards/chat.guard';

interface CreateGroupChatDto {
  name: string;
  participantIds: string[];
}

interface AddParticipantsDto {
  participantIds: string[];
}

@Controller('chats')
@UseGuards(ChatGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('direct/:userId')
  async createOrGetDirectChat(
    @Request() req,
    @Param('userId') otherUserId: string,
  ) {
    return this.chatService.createOrGetDirectChat(req.user.id, otherUserId);
  }

  @Post('group')
  async createGroupChat(
    @Request() req,
    @Body() createGroupDto: CreateGroupChatDto,
  ) {
    return this.chatService.createGroupChat(
      createGroupDto.name,
      createGroupDto.participantIds,
      req.user.id,
    );
  }

  @Get()
  async getMyConversations(@Request() req) {
    return this.chatService.getConversationsByUserId(req.user.id);
  }

  @Get(':id')
  async getConversation(@Param('id') id: string) {
    return this.chatService.getConversation(id);
  }

  @Post('group/:id/participants')
  async addParticipantsToGroup(
    @Request() req,
    @Param('id') conversationId: string,
    @Body() body: AddParticipantsDto,
  ) {
    return this.chatService.addParticipantsToGroup(
      conversationId,
      body.participantIds,
      req.user.id,
    );
  }

  @Post(':id/messages')
  async createMessage(
    @Request() req,
    @Param('id') conversationId: string,
    @Body() body: { content: string },
  ) {
    return this.chatService.createMessage(
      conversationId,
      body.content,
      req.user.id,
    );
  }
}
