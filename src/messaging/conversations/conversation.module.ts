import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationController } from './controllers/conversation.controller';
import { ConversationService } from './services/conversation.service';
import { ConversationEntity } from './entities/conversation.entity';
import { ParticipantEntity } from './entities/participant.entity';
import { MessageEntity } from '../messages/entities/message.entity';
import { User } from '../../user-management/entities/user.entity';
import { ConversationRepository } from './repositories/conversation.repository';
import { ParticipantRepository } from './repositories/participant.repository';
import { UserManagementModule } from '../../user-management/user-management.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConversationEntity,
      ParticipantEntity,
      MessageEntity,
      User,
    ]),
    UserManagementModule
  ],
  controllers: [ConversationController],
  providers: [
    ConversationService,
    ConversationRepository,
    ParticipantRepository,
  ],
  exports: [ConversationService, ConversationRepository, ParticipantRepository],
})
export class ConversationModule {}
