import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { Message } from '../../entities/chats/message.entity';
import { ChatGateway } from '../gateway/chat.gateway';
import { ChatController } from '../chat/chat.controller';
import { Conversation } from '../../entities/chats/conversation.entity';
import { ChatService } from '../chat/chat.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [TypeOrmModule.forFeature([Message, Conversation]), DatabaseModule],
  providers: [MessageService, ChatGateway, ChatService],
  controllers: [MessageController, ChatController],
})
export class MessageModule {}
