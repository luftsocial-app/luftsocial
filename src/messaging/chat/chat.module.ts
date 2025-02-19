import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { Conversation } from '../../entities/chats/conversation.entity';
import { Message } from '../../entities/chats/message.entity';
import { TenantService } from '../../database/tenant.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message]),
  ],
  providers: [ChatService, TenantService],
  exports: [ChatService],
})
export class ChatModule {}
