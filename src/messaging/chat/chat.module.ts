import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from '../gateway/chat.gateway';
import { Conversation } from '../../database/entities/chats/conversation.entity';
import { Message } from '../../database/entities/chats/message.entity';
import { User } from '../../database/entities/users/user.entity';
import { TenantService } from '../../database/tenant.service';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message, User])],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, TenantService],
  exports: [ChatService],
})
export class ChatModule {}
