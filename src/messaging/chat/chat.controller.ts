import { Controller, Post, Get, Body } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateConversationDto } from '../dtos/conversation.dto';

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('conversations')
  async getConversations() {
    return this.chatService.getConversations();
  }

  @Post('conversations')
  async createConversation(@Body() chatDTO: CreateConversationDto) {
    return this.chatService.createConversation(chatDTO);
  }
}
