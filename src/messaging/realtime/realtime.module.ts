import { Module } from '@nestjs/common';
import { MessagingGateway } from './gateways/messaging.gateway';
import { ConversationModule } from '../conversations/conversation.module';
import { MessageModule } from '../messages/message.module';
import { MessageValidatorService } from './services/message-validator.service';
import { ConfigModule } from '@nestjs/config';
import { ContentSanitizer } from '../shared/utils/content-sanitizer';
import { ParticipantEventHandler } from './gateways/usecases/participants.events';
import { MessageEventHandler } from './gateways/usecases/message.events';
import { WebsocketHelpers } from './utils/websocket.helpers';
import { UserManagementModule } from '../../user-management/user-management.module';
import { WebsocketSanitizationPipe } from './pipes/websocket-sanitization.pipe';

@Module({
  imports: [
    ConversationModule,
    MessageModule,
    ConfigModule,
    UserManagementModule,
  ],
  providers: [
    MessagingGateway,
    MessageValidatorService,
    ContentSanitizer,
    ParticipantEventHandler,
    MessageEventHandler,
    WebsocketHelpers,
    WebsocketSanitizationPipe,
  ],
  exports: [MessagingGateway],
})
export class RealtimeModule {}
