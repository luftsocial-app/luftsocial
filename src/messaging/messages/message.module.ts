import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageService } from './services/message.service';
import { MessageController } from './controllers/message.controller';
import { MessageEntity } from './entities/message.entity';
import { AttachmentEntity } from './entities/attachment.entity';
import { TenantService } from '../../database/tenant.service';
import { DatabaseModule } from '../../database/database.module';
import { MessageRepository } from './repositories/message.repository';
import { AttachmentRepository } from './repositories/attachment.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageEntity, AttachmentEntity]),
    DatabaseModule,
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
