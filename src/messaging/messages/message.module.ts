import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageService } from './services/message.service';
import { MessageController } from './controllers/message.controller';
import { MessageEntity } from './entities/message.entity';
import { AttachmentEntity } from './entities/attachment.entity';
import { MessageRepository } from './repositories/message.repository';
import { AttachmentRepository } from './repositories/attachment.repository';
import { TenantModule } from '../../user-management/tenant/tenant.module';
import { ConversationModule } from '../conversations/conversation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageEntity, AttachmentEntity]),
    TenantModule,
    TenantModule,
    ConversationModule,
  ],
  providers: [MessageService, MessageRepository, AttachmentRepository],
  controllers: [MessageController],
  exports: [MessageService, MessageRepository, AttachmentRepository],
})
export class MessageModule {}
