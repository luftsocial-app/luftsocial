import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationController } from './controllers/conversation.controller';
import { ConversationService } from './services/conversation.service';
import { ConversationEntity } from './entities/conversation.entity';
import { ParticipantEntity } from './entities/participant.entity';
import { MessageEntity } from '../messages/entities/message.entity';
import { User } from '../../entities/users/user.entity';
import { TenantService } from '../../database/tenant.service';
import { ConversationRepository } from './repositories/conversation.repository';
import { ParticipantRepository } from './repositories/participant.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ConversationEntity, ParticipantEntity, MessageEntity, User])],
  controllers: [ConversationController],
  providers: [
    ConversationService, 
    TenantService,
    ConversationRepository,
    ParticipantRepository,
  ],
  exports: [ConversationService, ConversationRepository, ParticipantRepository],
})
export class ConversationModule {} 