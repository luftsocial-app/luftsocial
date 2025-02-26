import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from '../gateway/chat.gateway';
import { Conversation } from '../../entities/chats/conversation.entity';
import { Message } from '../../entities/chats/message.entity';
import { User } from '../../entities/users/user.entity';
import { TenantAwareRepoModule } from '../../tenant-aware-repo/tenant-aware-repo.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, User]),
    TenantAwareRepoModule.forFeature([Conversation, Message, User]),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
