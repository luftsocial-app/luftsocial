import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageService } from './services/message.service';
import { MessageController } from './controllers/message.controller';
import { MessageEntity } from './entities/message.entity';
import { AttachmentEntity } from './entities/attachment.entity';
import { MessageRepository } from './repositories/message.repository';
import { AttachmentRepository } from './repositories/attachment.repository';
import { ConversationModule } from '../conversations/conversation.module';
import { UserManagementModule } from '../../user-management/user-management.module';
import { ContentSanitizer } from '../shared/utils/content-sanitizer';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageEntity, AttachmentEntity]),
    UserManagementModule,
    ConversationModule,
  ],
  providers: [
    MessageService,
    MessageRepository,
    AttachmentRepository,
    ContentSanitizer,
  ],
  controllers: [MessageController],
  exports: [MessageService, MessageRepository, AttachmentRepository],
})
export class MessageModule {}
