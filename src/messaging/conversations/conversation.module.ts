import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationController } from './controllers/conversation.controller';
import { ConversationService } from './services/conversation.service';
import { ConversationEntity } from './entities/conversation.entity';
import { ParticipantEntity } from './entities/participant.entity';
import { MessageEntity } from '../messages/entities/message.entity';
import { User } from '../../entities/users/user.entity';
import { ConversationRepository } from './repositories/conversation.repository';
import { ParticipantRepository } from './repositories/participant.repository';
import { TenantModule } from 'src/user-management/tenant/tenant.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConversationEntity,
      ParticipantEntity,
      MessageEntity,
      User,
    ]),
    TenantModule
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
