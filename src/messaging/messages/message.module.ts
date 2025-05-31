import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageService } from './services/message.service';
import { MessageController } from './controllers/message.controller';
import { MessageEntity } from './entities/message.entity';
import { AttachmentEntity } from './entities/attachment.entity';
import { MessageInboxEntity } from './entities/inbox.entity';
import { MessageRepository } from './repositories/message.repository';
import { AttachmentRepository } from './repositories/attachment.repository';
import { ConversationModule } from '../conversations/conversation.module';
import { UserManagementModule } from '../../user-management/user-management.module';
import { ContentSanitizer } from '../shared/utils/content-sanitizer';
import { MediaStorageModule } from '../../asset-management/media-storage/media-storage.module';
import { forwardRef } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { MessageInboxRepository } from './repositories/inbox.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MessageEntity,
      AttachmentEntity,
      MessageInboxEntity,
    ]),
    UserManagementModule,
    ConversationModule,
    MediaStorageModule,
    forwardRef(() => RealtimeModule),
  ],
  providers: [
    MessageService,
    MessageRepository,
    AttachmentRepository,
    MessageInboxRepository,
    ContentSanitizer,
  ],
  controllers: [MessageController],
  exports: [
    MessageService,
    MessageRepository,
    AttachmentRepository,
    MessageInboxRepository,
    ContentSanitizer,
  ],
})
export class MessageModule {}
