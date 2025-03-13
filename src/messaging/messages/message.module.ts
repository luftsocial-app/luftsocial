import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageService } from './services/message.service';
import { MessageController } from './controllers/message.controller';
import { MessageEntity } from './entities/message.entity';
import { AttachmentEntity } from './entities/attachment.entity';
import { TenantService } from '../../database/tenant.service';
import { DatabaseModule } from '../../database/database.module';
import { MessageRepository } from './repositories/message.repository';
import { AttachmentRepository } from './repositories/attachment.repository';
import { ConversationModule } from '../conversations/conversation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageEntity, AttachmentEntity]),
    DatabaseModule,
    forwardRef(() => ConversationModule),
  ],
  providers: [
    MessageService,
    TenantService,
    MessageRepository,
    AttachmentRepository,
  ],
  controllers: [MessageController],
  exports: [MessageService, MessageRepository, AttachmentRepository],
})
export class MessageModule {}
