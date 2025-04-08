import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ConversationModule } from './conversations/conversation.module';
import { MessageModule } from './messages/message.module';
import { RealtimeModule } from './realtime/realtime.module';
import { WebsocketSanitizationPipe } from './realtime/pipes/websocket-sanitization.pipe';
import { ContentSanitizer } from './shared/utils/content-sanitizer';

@Module({
  imports: [ConversationModule, MessageModule, RealtimeModule],
  providers: [
    ContentSanitizer,
    {
      provide: APP_PIPE,
      useClass: WebsocketSanitizationPipe,
    },
  ],
  exports: [ConversationModule, MessageModule, RealtimeModule],
})
export class MessagingModule {}
