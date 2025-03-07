import { Module } from '@nestjs/common';
import { MessagingGateway } from './gateways/messaging.gateway';
import { ConversationModule } from '../conversations/conversation.module';
import { MessageModule } from '../messages/message.module';
import { MessageValidatorService } from './services/message-validator.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConversationModule,
    MessageModule,
    ConfigModule,
  ],
  providers: [
    MessagingGateway,
    MessageValidatorService,
  ],
  exports: [
    MessagingGateway,
  ],
})
export class RealtimeModule {} 