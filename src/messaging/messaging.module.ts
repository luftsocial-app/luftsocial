import { Module } from '@nestjs/common';
import { ConversationModule } from './conversations/conversation.module';
import { MessageModule } from './messages/message.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [ConversationModule, MessageModule, RealtimeModule],
  exports: [ConversationModule, MessageModule, RealtimeModule],
})
export class MessagingModule {}
